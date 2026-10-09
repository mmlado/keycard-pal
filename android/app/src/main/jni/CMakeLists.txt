# Keycard Pal's app CMake: React Native's default app setup, plus the codegen'd
# TurboModule specs of the online-only native modules on the full flavor only.
#
# Autolinking generates Android-autolinking.cmake and autolinking.cpp once, for
# every flavor. The packages that react-native.config.js keeps out of autolinking
# (`android: null`) get their react_codegen_<spec> targets added here instead,
# but only when Gradle passes their codegen directories: android/app/build.gradle
# sets KEYCARDPAL_ONLINE_CODEGEN_DIRS on the full flavor and nothing on offline.
#
# The provider that resolves those specs, online/OnlineModuleProvider.cpp, is
# handed to React Native's stock OnLoad.cpp through its app-module hook
# (REACT_NATIVE_APP_MODULE_PROVIDER, see
# ReactAndroid/cmake-utils/default-app-setup/OnLoad.cpp). Keeping the .cpp in a
# subdirectory matters: a .cpp next to this file would replace OnLoad.cpp
# entirely (ReactNative-application.cmake globs *.cpp here as an override).
cmake_minimum_required(VERSION 3.13)
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

if(KEYCARDPAL_ONLINE_CODEGEN_DIRS)
  string(REPLACE "|" ";" online_codegen_dirs "${KEYCARDPAL_ONLINE_CODEGEN_DIRS}")
  set(online_codegen_index 0)
  foreach(codegen_dir ${online_codegen_dirs})
    add_subdirectory("${codegen_dir}" "online_codegen_${online_codegen_index}")
    math(EXPR online_codegen_index "${online_codegen_index} + 1")
    # Mirrors what ReactNative-application.cmake does for AUTOLINKED_LIBRARIES.
    get_property(codegen_targets DIRECTORY "${codegen_dir}" PROPERTY BUILDSYSTEM_TARGETS)
    target_link_libraries(${CMAKE_PROJECT_NAME} ${codegen_targets})
    foreach(codegen_target ${codegen_targets})
      target_link_libraries(${codegen_target} common_flags)
    endforeach()
  endforeach()

  target_sources(${CMAKE_PROJECT_NAME} PRIVATE online/OnlineModuleProvider.cpp)
  target_compile_definitions(${CMAKE_PROJECT_NAME}
    PRIVATE
    REACT_NATIVE_APP_CODEGEN_HEADER="online/OnlineModuleProvider.h"
    REACT_NATIVE_APP_MODULE_PROVIDER=keycardpal_online_ModuleProvider
  )
endif()
