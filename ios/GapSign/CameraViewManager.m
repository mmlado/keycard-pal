#import <React/RCTViewManager.h>
#import "CameraView.h"

@interface CameraViewManager : RCTViewManager
@end

@implementation CameraViewManager

RCT_EXPORT_MODULE(CameraView)

- (UIView *)view {
  return [[CameraView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(onReadCode, RCTDirectEventBlock)

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

@end
