#include "ink_core.hpp"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

using mathnote::ink::Brush;
using mathnote::ink::CommandType;
using mathnote::ink::Point;
using mathnote::ink::Stroke;

namespace {

Stroke sampleStroke(Brush brush) {
  return {{{20, 30, 0.05, 0}, {80, 100, 0.4, 8}, {160, 50, 1, 16}, {220, 130, 0.65, 24}},
          brush,
          1};
}

void dumpCase(std::ostream& output, const std::string& name, const Stroke& stroke) {
  output << "case " << name << '\n';
  for (const auto& command : mathnote::ink::buildStrokeCommands(stroke)) {
    output << static_cast<int>(command.type);
    const int values = command.type == CommandType::MoveTo || command.type == CommandType::LineTo
                           ? 2
                           : command.type == CommandType::Circle
                                 ? 3
                                 : command.type == CommandType::Rect ? 4 : 0;
    for (int i = 0; i < values; ++i) output << ' ' << command.values[i];
    output << '\n';
  }
  output << "end\n";
}

}  // namespace

int main(int argc, char** argv) {
  if (argc == 2 && std::string(argv[1]) == "--dump") {
    std::cout << std::setprecision(12);
    dumpCase(std::cout, "pen", sampleStroke(Brush::Pen));
    dumpCase(std::cout, "ballpoint", sampleStroke(Brush::Ballpoint));
    dumpCase(std::cout, "fountain", sampleStroke(Brush::Fountain));
    dumpCase(std::cout, "highlighter", sampleStroke(Brush::Highlighter));
    dumpCase(std::cout, "highlighter_dot", {{{50, 50, 0.5, 0}}, Brush::Highlighter, 1});
    return 0;
  }

  const auto ballpoint = mathnote::ink::styleFor(Brush::Ballpoint);
  assert(mathnote::ink::pressureToWidth(0.1, ballpoint) == 2);
  assert(mathnote::ink::pressureToWidth(1, ballpoint) == 2);

  const auto fountain = mathnote::ink::styleFor(Brush::Fountain);
  assert(mathnote::ink::pressureToWidth(1, fountain) >
         mathnote::ink::pressureToWidth(0.1, fountain));

  const auto dot = mathnote::ink::buildStrokeCommands({{{50, 50, 0.5, 0}}, Brush::Highlighter, 1});
  assert(dot.size() == 1);
  assert(dot[0].type == CommandType::Rect);
  assert(dot[0].values[3] > dot[0].values[2]);

  const auto highlighter = mathnote::ink::buildStrokeCommands(sampleStroke(Brush::Highlighter));
  assert(std::none_of(highlighter.begin(), highlighter.end(), [](const auto& command) {
    return command.type == CommandType::Circle;
  }));

  const auto pen = mathnote::ink::buildStrokeCommands(sampleStroke(Brush::Pen));
  assert(std::count_if(pen.begin(), pen.end(), [](const auto& command) {
           return command.type == CommandType::Circle;
         }) == 2);

  std::cout << "C++ ink core tests passed\n";
  return 0;
}
