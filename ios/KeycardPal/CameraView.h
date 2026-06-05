#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface CameraView : UIView
@property (nonatomic, copy) void (^onReadCode)(NSDictionary *);
@end

NS_ASSUME_NONNULL_END
