#import "CameraView.h"
#import <AVFoundation/AVFoundation.h>
#import <CoreImage/CoreImage.h>

@interface CameraView () <AVCaptureMetadataOutputObjectsDelegate>
@property (nonatomic, strong) AVCaptureSession *session;
@property (nonatomic, strong) AVCaptureVideoPreviewLayer *previewLayer;
@property (nonatomic, strong) dispatch_queue_t sessionQueue;
@end

// `stringValue` is nil for a payload that is not valid UTF-8, so a binary QR is
// invisible through it. The descriptor's errorCorrectedPayload is the codeword
// stream, which still carries the segment headers and padding, so the byte-mode
// segments have to be read out of the bitstream by hand. Android gets the same
// bytes for free from ZXing's BYTE_SEGMENTS.

typedef struct {
  const uint8_t *data;
  size_t bitLen;
  size_t pos;
} KPBitReader;

static int KPReadBits(KPBitReader *r, int n, uint32_t *out) {
  if (n <= 0 || n > 32 || r->pos + (size_t)n > r->bitLen) return 0;
  uint32_t v = 0;
  for (int i = 0; i < n; i++) {
    size_t p = r->pos + (size_t)i;
    v = (v << 1) | ((r->data[p >> 3] >> (7 - (p & 7))) & 1u);
  }
  r->pos += (size_t)n;
  *out = v;
  return 1;
}

static NSData *KPByteSegments(NSData *payload, NSInteger version) {
  if (payload.length == 0) return nil;
  KPBitReader r = {payload.bytes, payload.length * 8, 0};
  NSMutableData *out = [NSMutableData data];
  for (;;) {
    uint32_t mode;
    if (!KPReadBits(&r, 4, &mode)) break;
    if (mode == 0x0) break;             // terminator
    if (mode == 0x7) {                  // ECI designator, skipped
      uint32_t b0, rest;
      if (!KPReadBits(&r, 8, &b0)) break;
      if ((b0 & 0x80u) == 0) {
        // one-byte designator, fully consumed
      } else if ((b0 & 0xC0u) == 0x80u) {
        if (!KPReadBits(&r, 8, &rest)) break;
      } else if ((b0 & 0xE0u) == 0xC0u) {
        if (!KPReadBits(&r, 16, &rest)) break;
      } else {
        break;
      }
      continue;
    }
    if (mode == 0x4) {                  // byte mode
      uint32_t count;
      if (!KPReadBits(&r, version <= 9 ? 8 : 16, &count)) break;
      for (uint32_t i = 0; i < count; i++) {
        uint32_t byte;
        if (!KPReadBits(&r, 8, &byte)) return out.length ? out : nil;
        uint8_t b = (uint8_t)byte;
        [out appendBytes:&b length:1];
      }
      continue;
    }
    break;                              // numeric, alphanumeric, kanji, other
  }
  return out.length ? out : nil;
}

@implementation CameraView

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    _sessionQueue = dispatch_queue_create("tech.gapsign.camera", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (self.window) {
    [self startSession];
  } else {
    [self stopSession];
  }
}

- (void)layoutSubviews {
  [super layoutSubviews];
  self.previewLayer.frame = self.bounds;
}

- (void)startSession {
  dispatch_async(self.sessionQueue, ^{
    if (self.session) return;

    AVCaptureSession *session = [[AVCaptureSession alloc] init];
    session.sessionPreset = AVCaptureSessionPresetHigh;

    AVCaptureDevice *device = [AVCaptureDevice defaultDeviceWithMediaType:AVMediaTypeVideo];
    if (!device) return;

    NSError *error = nil;
    AVCaptureDeviceInput *input = [AVCaptureDeviceInput deviceInputWithDevice:device error:&error];
    if (!input || error) return;

    AVCaptureMetadataOutput *output = [[AVCaptureMetadataOutput alloc] init];

    if (![session canAddInput:input] || ![session canAddOutput:output]) return;

    [session addInput:input];
    [session addOutput:output];

    [output setMetadataObjectsDelegate:self queue:dispatch_get_main_queue()];
    if ([output.availableMetadataObjectTypes containsObject:AVMetadataObjectTypeQRCode]) {
      output.metadataObjectTypes = @[AVMetadataObjectTypeQRCode];
    }

    AVCaptureVideoPreviewLayer *layer = [AVCaptureVideoPreviewLayer layerWithSession:session];
    layer.videoGravity = AVLayerVideoGravityResizeAspectFill;

    dispatch_async(dispatch_get_main_queue(), ^{
      layer.frame = self.bounds;
      [self.layer insertSublayer:layer atIndex:0];
      self.previewLayer = layer;
    });

    [session startRunning];
    self.session = session;
  });
}

- (void)stopSession {
  dispatch_async(self.sessionQueue, ^{
    [self.session stopRunning];
    self.session = nil;
    dispatch_async(dispatch_get_main_queue(), ^{
      [self.previewLayer removeFromSuperlayer];
      self.previewLayer = nil;
    });
  });
}

- (void)captureOutput:(AVCaptureOutput *)output
    didOutputMetadataObjects:(NSArray<__kindof AVMetadataObject *> *)metadataObjects
             fromConnection:(AVCaptureConnection *)connection {
  // Deliberately no emit-once guard: a multi-part UR needs one event per frame.
  // Duplicate parts are absorbed by the decoder, and QRScannerScreen stops
  // itself once the UR completes.
  for (AVMetadataObject *obj in metadataObjects) {
    if (![obj isKindOfClass:[AVMetadataMachineReadableCodeObject class]]) continue;
    AVMetadataMachineReadableCodeObject *code = (AVMetadataMachineReadableCodeObject *)obj;

    NSData *bytes = nil;
    if ([code.descriptor isKindOfClass:[CIQRCodeDescriptor class]]) {
      CIQRCodeDescriptor *qr = (CIQRCodeDescriptor *)code.descriptor;
      bytes = KPByteSegments(qr.errorCorrectedPayload, qr.symbolVersion);
    }

    // A binary payload has no stringValue, so it is only readable as bytes.
    NSString *value = code.stringValue;
    if (!value && !bytes) continue;

    if (self.onReadCode) {
      self.onReadCode(@{
        @"codeStringValue": value ?: @"",
        @"codeBytesBase64": bytes ? [bytes base64EncodedStringWithOptions:0] : [NSNull null],
      });
    }
    break;
  }
}

@end
