#include "ink_core.hpp"

#include <algorithm>
#include <cmath>

namespace mathnote::ink {
namespace {

constexpr PenStyle kPen{1.2, 5.4, 0.65};
constexpr PenStyle kBallpoint{2.0, 2.0, 1.0};
constexpr PenStyle kFountain{0.8, 5.0, 1.4};
constexpr PenStyle kHighlighter{14.0, 14.0, 1.0};

struct Sample {
  double x;
  double y;
  double width;
};

double clamp(double value, double min, double max) {
  return std::min(max, std::max(min, value));
}

double catmull(double p0, double p1, double p2, double p3, double t) {
  const double t2 = t * t;
  const double t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

std::vector<Sample> buildSamples(const Stroke& stroke, const PenStyle& style) {
  const auto& points = stroke.points;
  const int count = static_cast<int>(points.size());
  std::vector<Sample> samples;
  if (count == 0) return samples;

  if (count == 1) {
    samples.push_back({points[0].x, points[0].y,
                       pressureToWidth(points[0].pressure, style) * stroke.size});
    return samples;
  }

  for (int i = 0; i < count - 1; ++i) {
    const auto& a = points[std::max(0, i - 1)];
    const auto& b = points[i];
    const auto& c = points[i + 1];
    const auto& d = points[std::min(count - 1, i + 2)];
    const double distance = std::hypot(c.x - b.x, c.y - b.y);
    const int steps = static_cast<int>(clamp(std::round(distance / 1.2), 1, 64));

    for (int step = 0; step < steps; ++step) {
      const double t = static_cast<double>(step) / steps;
      samples.push_back({
          catmull(a.x, b.x, c.x, d.x, t),
          catmull(a.y, b.y, c.y, d.y, t),
          pressureToWidth(b.pressure + (c.pressure - b.pressure) * t, style) *
              stroke.size,
      });
    }
  }

  const auto& last = points.back();
  samples.push_back(
      {last.x, last.y, pressureToWidth(last.pressure, style) * stroke.size});
  return samples;
}

Command command(CommandType type, double a = 0, double b = 0, double c = 0,
                double d = 0) {
  return {type, {a, b, c, d}};
}

}  // namespace

PenStyle styleFor(Brush brush) {
  switch (brush) {
    case Brush::Ballpoint:
      return kBallpoint;
    case Brush::Fountain:
      return kFountain;
    case Brush::Highlighter:
      return kHighlighter;
    case Brush::Pen:
      return kPen;
  }
  return kPen;
}

double pressureToWidth(double pressure, const PenStyle& style) {
  const double t = std::pow(clamp(pressure, 0.06, 1.0), style.gamma);
  return style.minWidth + (style.maxWidth - style.minWidth) * t;
}

std::vector<Command> buildStrokeCommands(const Stroke& stroke) {
  const auto style = styleFor(stroke.brush);
  const auto samples = buildSamples(stroke, style);
  std::vector<Command> commands;
  if (samples.empty()) return commands;

  const bool highlighter = stroke.brush == Brush::Highlighter;
  if (samples.size() == 1) {
    const auto& sample = samples[0];
    if (highlighter) {
      const double nibWidth = std::max(2.0, stroke.size * 2.0);
      commands.push_back(command(CommandType::Rect, sample.x - nibWidth / 2,
                                 sample.y - sample.width / 2, nibWidth, sample.width));
    } else {
      commands.push_back(
          command(CommandType::Circle, sample.x, sample.y, std::max(sample.width / 2, 0.2)));
    }
    return commands;
  }

  const int count = static_cast<int>(samples.size());
  std::vector<Sample> left(count);
  std::vector<Sample> right(count);
  for (int i = 0; i < count; ++i) {
    const auto& previous = samples[std::max(0, i - 1)];
    const auto& next = samples[std::min(count - 1, i + 1)];
    double dx = next.x - previous.x;
    double dy = next.y - previous.y;
    const double length = std::hypot(dx, dy);
    if (length != 0) {
      dx /= length;
      dy /= length;
    } else {
      dx = 0;
      dy = 0;
    }
    const double halfWidth = samples[i].width / 2;
    left[i] = {samples[i].x - dy * halfWidth, samples[i].y + dx * halfWidth, 0};
    right[i] = {samples[i].x + dy * halfWidth, samples[i].y - dx * halfWidth, 0};
  }

  commands.push_back(command(CommandType::MoveTo, left[0].x, left[0].y));
  for (int i = 1; i < count; ++i) {
    commands.push_back(command(CommandType::LineTo, left[i].x, left[i].y));
  }
  for (int i = count - 1; i >= 0; --i) {
    commands.push_back(command(CommandType::LineTo, right[i].x, right[i].y));
  }
  commands.push_back(command(CommandType::Close));

  if (!highlighter) {
    const auto& first = samples.front();
    const auto& last = samples.back();
    commands.push_back(command(CommandType::Circle, first.x, first.y,
                               std::max(first.width / 2, 0.2)));
    commands.push_back(command(CommandType::Circle, last.x, last.y,
                               std::max(last.width / 2, 0.2)));
  }
  return commands;
}

}  // namespace mathnote::ink
