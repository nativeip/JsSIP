const Utils = require('./Utils');
const Grammar = require('./Grammar');
const debugerror = require('react-native-debug')('JsSIP:ERROR:Socket');

debugerror.log = console.warn.bind(console);

/**
 * Interface documentation: https://jssip.net/documentation/$last_version/api/socket/
 *
 * interface Socket {
 *  attribute String via_transport
 *  attribute String url
 *  attribute String sip_uri
 *
 *  method connect();
 *  method disconnect();
 *  method send(data);
 *
 *  attribute EventHandler onconnect
 *  attribute EventHandler ondisconnect
 *  attribute EventHandler ondata
 * }
 *
 */

exports.isSocket = (socket) =>
{
  // Ignore if an array is given.
  if (Array.isArray(socket))
  {
    return false;
  }

  if (typeof socket === 'undefined')
  {
    debugerror('undefined JsSIP.Socket instance');

    return false;
  }

  // Check Properties.
  try
  {
    if (!Utils.isString(socket.url))
    {
      debugerror('missing or invalid JsSIP.Socket url property');
      throw new Error('Missing or invalid JsSIP.Socket url property');
    }

    if (!Utils.isString(socket.via_transport))
    {
      debugerror('missing or invalid JsSIP.Socket via_transport property');
      throw new Error('Missing or invalid JsSIP.Socket via_transport property');
    }

    if (Grammar.parse(socket.sip_uri, 'SIP_URI') === -1)
    {
      debugerror('missing or invalid JsSIP.Socket sip_uri property');
      throw new Error('missing or invalid JsSIP.Socket sip_uri property');
    }
  }
  catch (e)
  {
    return false;
  }

  // Check Methods.
  try
  {
    [ 'connect', 'disconnect', 'send' ].forEach((method) =>
    {
      if (!Utils.isFunction(socket[method]))
      {
        debugerror(`missing or invalid JsSIP.Socket method: ${method}`);
        throw new Error(`Missing or invalid JsSIP.Socket method: ${method}`);
      }
    });
  }
  catch (e)
  {
    return false;
  }

  return true;
};
