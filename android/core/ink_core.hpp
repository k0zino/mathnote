#pragma once

#include <array>
#include <vector>

namespace mathnote::ink {

enum class Brush : int {
  Pen = 0,
  Ballpoint = 1,
  Fountain = 2,
  Highlighter = 3,
};

struct Point {
  double x;
  double y;
  double pressure;
  double timestamp;
};

struct Stroke {
  std::vector<Point> points;
  Brush brush;
  double size;
};

struct PenStyle {
  double minWidth;
  double maxWidth;
  double gamma;
};

enum class CommandType : int {
  MoveTo = 1,
  LineTo = 2,
  Close = 3,
  Circle = 4,
  Rect = 5,
};

struct Command {
  CommandType type;
  std::array<double, 4> values;
};

PenStyle styleFor(Brush brush);
double pressureToWidth(double pressure, const PenStyle& style);
std::vector<Command> buildStrokeCommands(const Stroke& stroke);

}  // namespace mathnote::ink
