#import "BuildConfigModule.h"

@implementation BuildConfigModule

RCT_EXPORT_MODULE(BuildConfig)

- (NSDictionary *)constantsToExport {
  id raw = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"WC_PROJECT_ID"];
  id rawInternet =
      [[NSBundle mainBundle] objectForInfoDictionaryKey:@"INTERNET_ENABLED"];
  NSString *wcProjectId = @"";
  BOOL internetEnabled = [rawInternet respondsToSelector:@selector(boolValue)]
                             ? [rawInternet boolValue]
                             : NO;
  if ([raw isKindOfClass:[NSString class]]) {
    NSString *str = (NSString *)raw;
    // Xcode leaves the literal "$(WC_PROJECT_ID)" when the build var is unset
    if (![str hasPrefix:@"$("]) {
      wcProjectId = str;
    }
  }
  return @{
    @"INTERNET_ENABLED" : @(internetEnabled),
    @"WC_PROJECT_ID" : wcProjectId,
  };
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end
