cmake_minimum_required(VERSION 3.22.1)
project(mathnote_ink)

add_library(inkcore STATIC ../../../../core/ink_core.cpp)
target_include_directories(inkcore PUBLIC ../../../../core)
target_compile_features(inkcore PUBLIC cxx_std_17)

add_library(mathnote_ink SHARED jni_bridge.cpp)
target_link_libraries(mathnote_ink inkcore android log)
