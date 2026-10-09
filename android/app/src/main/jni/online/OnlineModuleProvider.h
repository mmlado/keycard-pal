#pragma once

#include <ReactCommon/JavaTurboModule.h>
#include <ReactCommon/TurboModule.h>

#include <memory>
#include <string>

namespace facebook::react {

// TurboModule provider for the native modules linked only into the full flavor
// (the packages react-native.config.js keeps out of autolinking). Reached from
// React Native's stock OnLoad.cpp through REACT_NATIVE_APP_MODULE_PROVIDER,
// which android/app/src/main/jni/CMakeLists.txt defines on the full flavor.
std::shared_ptr<TurboModule> keycardpal_online_ModuleProvider(
    const std::string& moduleName,
    const JavaTurboModule::InitParams& params);

} // namespace facebook::react
