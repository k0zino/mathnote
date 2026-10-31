#include <jni.h>

#include <vector>

#include "ink_core.hpp"

extern "C" JNIEXPORT jfloatArray JNICALL
Java_cn_mathnote_ink_InkNative_nativeRenderStroke(JNIEnv* env, jclass, jfloatArray input,
                                                   jint brush, jfloat size) {
  const int length = env->GetArrayLength(input);
  if (length % 4 != 0) return env->NewFloatArray(0);

  std::vector<mathnote::ink::Point> points;
  points.reserve(length / 4);
  std::vector<jfloat> values(length);
  env->GetFloatArrayRegion(input, 0, length, values.data());
  for (int i = 0; i < length; i += 4) {
    points.push_back({values[i], values[i + 1], values[i + 2], values[i + 3]});
  }

  const mathnote::ink::Stroke stroke{points, static_cast<mathnote::ink::Brush>(brush), size};
  const auto commands = mathnote::ink::buildStrokeCommands(stroke);
  std::vector<jfloat> output;
  output.reserve(commands.size() * 5);
  for (const auto& command : commands) {
    output.push_back(static_cast<jfloat>(command.type));
    for (const double value : command.values) output.push_back(static_cast<jfloat>(value));
  }

  jfloatArray result = env->NewFloatArray(static_cast<int>(output.size()));
  env->SetFloatArrayRegion(result, 0, static_cast<int>(output.size()), output.data());
  return result;
}
