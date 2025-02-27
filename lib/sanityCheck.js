const JsSIP_C = require('./Constants');
const SIPMessage = require('./SIPMessage');
const Utils = require('./Utils');
const debug = require('react-native-debug')('JsSIP:sanityCheck');

// Checks for requests and responses.
const all = [ minimumHeaders ];

// Checks for requests.
const requests = [
  rfc3261_8_2_2_1,
  rfc3261_16_3_4,
  rfc3261_18_3_request,
  rfc3261_8_2_2_2
];

// Checks for responses.
const responses = [
  rfc3261_8_1_3_3,
  rfc3261_18_3_response
];

// local variables.
let message;
let ua;
let transport;

module.exports = (m, u, t) =>
{
  message = m;
  ua = u;
  transport = t;

  for (const check of all)
  {
    if (check() === false)
    {
      return false;
    }
  }

  if (message instanceof SIPMessage.IncomingRequest)
  {
    for (const check of requests)
    {
      if (check() === false)
      {
        return false;
      }
    }
  }

  else if (message instanceof SIPMessage.IncomingResponse)
  {
    for (const check of responses)
    {
      if (check() === false)
      {
        return false;
      }
    }
  }

  // Everything is OK.
  return true;
};


/*
 * Sanity Check for incoming Messages
 *
 * Requests:
 *  - _rfc3261_8_2_2_1_ Receive a Request with a non supported URI scheme
 *  - _rfc3261_16_3_4_ Receive a Request already sent by us
 *   Does not look at via sent-by but at jssip_id, which is inserted as
 *   a prefix in all initial requests generated by the ua
 *  - _rfc3261_18_3_request_ Body Content-Length
 *  - _rfc3261_8_2_2_2_ Merged Requests
 *
 * Responses:
 *  - _rfc3261_8_1_3_3_ Multiple Via headers
 *  - _rfc3261_18_3_response_ Body Content-Length
 *
 * All:
 *  - Minimum headers in a SIP message
 */

// Sanity Check functions for requests.
function rfc3261_8_2_2_1()
{
  if (message.s('to').uri.scheme !== 'sip')
  {
    reply(416);

    return false;
  }
}

function rfc3261_16_3_4()
{
  if (!message.to_tag)
  {
    if (message.call_id.substr(0, 5) === ua.configuration.jssip_id)
    {
      reply(482);

      return false;
    }
  }
}

function rfc3261_18_3_request()
{
  const len = Utils.str_utf8_length(message.body);
  const contentLength = message.getHeader('content-length');

  if (len < contentLength)
  {
    reply(400);

    return false;
  }
}

function rfc3261_8_2_2_2()
{
  const fromTag = message.from_tag;
  const call_id = message.call_id;
  const cseq = message.cseq;
  let tr;

  // Accept any in-dialog request.
  if (message.to_tag)
  {
    return;
  }

  // INVITE request.
  if (message.method === JsSIP_C.INVITE)
  {
    // If the branch matches the key of any IST then assume it is a retransmission
    // and ignore the INVITE.
    // TODO: we should reply the last response.
    if (ua._transactions.ist[message.via_branch])
    {
      return false;
    }
    // Otherwise check whether it is a merged request.
    else
    {
      for (const transaction in ua._transactions.ist)
      {
        if (Object.prototype.hasOwnProperty.call(ua._transactions.ist, transaction))
        {
          tr = ua._transactions.ist[transaction];
          if (tr.request.from_tag === fromTag &&
              tr.request.call_id === call_id &&
              tr.request.cseq === cseq)
          {
            reply(482);

            return false;
          }
        }
      }
    }
  }

  // Non INVITE request.

  // If the branch matches the key of any NIST then assume it is a retransmission
  // and ignore the request.
  // TODO: we should reply the last response.
  else if (ua._transactions.nist[message.via_branch])
  {
    return false;
  }

  // Otherwise check whether it is a merged request.
  else
  {
    for (const transaction in ua._transactions.nist)
    {
      if (Object.prototype.hasOwnProperty.call(ua._transactions.nist, transaction))
      {
        tr = ua._transactions.nist[transaction];
        if (tr.request.from_tag === fromTag &&
            tr.request.call_id === call_id &&
            tr.request.cseq === cseq)
        {
          reply(482);

          return false;
        }
      }
    }
  }
}

// Sanity Check functions for responses.
function rfc3261_8_1_3_3()
{
  if (message.getHeaders('via').length > 1)
  {
    debug(
      'more than one Via header field present in the response, dropping the response'
    );

    return false;
  }
}

function rfc3261_18_3_response()
{
  const len = Utils.str_utf8_length(message.body), contentLength = message.getHeader('content-length');

  if (len < contentLength)
  {
    debug(
      'message body length is lower than the value in Content-Length header field, dropping the response'
    );

    return false;
  }
}

// Sanity Check functions for requests and responses.
function minimumHeaders()
{
  const mandatoryHeaders = [ 'from', 'to', 'call_id', 'cseq', 'via' ];

  for (const header of mandatoryHeaders)
  {
    if (!message.hasHeader(header))
    {
      debug(
        `missing mandatory header field : ${header}, dropping the response`
      );

      return false;
    }
  }
}

// Reply.
function reply(status_code)
{
  const vias = message.getHeaders('via');

  let to;
  let response = `SIP/2.0 ${status_code} ${JsSIP_C.REASON_PHRASE[status_code]}\r\n`;

  for (const via of vias)
  {
    response += `Via: ${via}\r\n`;
  }

  to = message.getHeader('To');

  if (!message.to_tag)
  {
    to += `;tag=${Utils.newTag()}`;
  }

  response += `To: ${to}\r\n`;
  response += `From: ${message.getHeader('From')}\r\n`;
  response += `Call-ID: ${message.call_id}\r\n`;
  response += `CSeq: ${message.cseq} ${message.method}\r\n`;
  response += '\r\n';

  transport.send(response);
}
