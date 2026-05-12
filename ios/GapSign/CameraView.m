#import "CameraView.h"
#import <AVFoundation/AVFoundation.h>

@interface CameraView () <AVCaptureMetadataOutputObjectsDelegate>
@property (nonatomic, strong) AVCaptureSession *session;
@property (nonatomic, strong) AVCaptureVideoPreviewLayer *previewLayer;
@property (nonatomic, strong) dispatch_queue_t sessionQueue;
@property (nonatomic, assign) BOOL didEmit;
@end

@implementation CameraView

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    _sessionQueue = dispatch_queue_create("tech.gapsign.camera", DISPATCH_QUEUE_SERIAL);
    _didEmit = NO;
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
      self.didEmit = NO;
    });
  });
}

- (void)captureOutput:(AVCaptureOutput *)output
    didOutputMetadataObjects:(NSArray<__kindof AVMetadataObject *> *)metadataObjects
             fromConnection:(AVCaptureConnection *)connection {
  if (self.didEmit) return;

  for (AVMetadataObject *obj in metadataObjects) {
    if ([obj isKindOfClass:[AVMetadataMachineReadableCodeObject class]]) {
      NSString *value = ((AVMetadataMachineReadableCodeObject *)obj).stringValue;
      if (!value) continue;
      self.didEmit = YES;
      if (self.onReadCode) {
        self.onReadCode(@{@"codeStringValue": value});
      }
      break;
    }
  }
}

@end
