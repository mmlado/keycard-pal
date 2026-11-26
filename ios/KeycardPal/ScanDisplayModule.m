#import "ScanDisplayModule.h"

#import <UIKit/UIKit.h>

@implementation ScanDisplayModule {
  BOOL _raised;
  CGFloat _previousBrightness;
}

RCT_EXPORT_MODULE(ScanDisplay)

- (instancetype)init {
  if (self = [super init]) {
    // Brightness is system-wide and outlives the app.
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(restoreDisplay)
               name:UIApplicationWillTerminateNotification
             object:nil];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (void)restoreDisplay {
  if (!_raised) {
    return;
  }
  _raised = NO;
  [UIScreen mainScreen].brightness = _previousBrightness;
  [UIApplication sharedApplication].idleTimerDisabled = NO;
}

RCT_EXPORT_METHOD(raise) {
  if (!_raised) {
    _raised = YES;
    _previousBrightness = [UIScreen mainScreen].brightness;
  }
  [UIScreen mainScreen].brightness = 1.0;
  [UIApplication sharedApplication].idleTimerDisabled = YES;
}

RCT_EXPORT_METHOD(restore) {
  [self restoreDisplay];
}

@end
