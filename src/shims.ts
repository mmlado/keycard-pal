import 'node-libs-react-native/globals';
import { Buffer } from 'buffer';
import { TextDecoder, TextEncoder } from 'text-encoding';

global.Buffer = global.Buffer || Buffer;

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
}
