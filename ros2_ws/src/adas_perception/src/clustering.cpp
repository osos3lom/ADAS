// Phase 2A — Euclidean clustering implementation (PCL).
#include "adas_perception/clustering.hpp"

#include <algorithm>
#include <cmath>
#include <limits>

#include <pcl/search/kdtree.h>
#include <pcl/segmentation/extract_clusters.h>

namespace adas_perception
{

std::vector<Cluster> euclidean_cluster(
  const pcl::PointCloud<pcl::PointXYZ>::ConstPtr & cloud,
  double tolerance_m,
  int min_points,
  int max_points)
{
  std::vector<Cluster> out;
  if (!cloud || cloud->empty()) {
    return out;
  }

  auto tree = pcl::search::KdTree<pcl::PointXYZ>::Ptr(
    new pcl::search::KdTree<pcl::PointXYZ>());
  tree->setInputCloud(cloud);

  std::vector<pcl::PointIndices> indices;
  pcl::EuclideanClusterExtraction<pcl::PointXYZ> ec;
  ec.setClusterTolerance(tolerance_m);
  ec.setMinClusterSize(min_points);
  ec.setMaxClusterSize(max_points);
  ec.setSearchMethod(tree);
  ec.setInputCloud(cloud);
  ec.extract(indices);

  out.reserve(indices.size());
  for (const auto & idx : indices) {
    Cluster c;
    c.num_points = idx.indices.size();
    c.min_x = c.min_y = c.min_z = std::numeric_limits<float>::max();
    c.max_x = c.max_y = c.max_z = std::numeric_limits<float>::lowest();
    c.range = std::numeric_limits<float>::max();

    double sx = 0.0, sy = 0.0, sz = 0.0;
    for (int i : idx.indices) {
      const auto & p = cloud->points[static_cast<std::size_t>(i)];
      sx += p.x; sy += p.y; sz += p.z;
      c.min_x = std::min(c.min_x, p.x); c.max_x = std::max(c.max_x, p.x);
      c.min_y = std::min(c.min_y, p.y); c.max_y = std::max(c.max_y, p.y);
      c.min_z = std::min(c.min_z, p.z); c.max_z = std::max(c.max_z, p.z);
      c.range = std::min(c.range, static_cast<float>(std::hypot(p.x, p.y)));
    }
    const double n = static_cast<double>(c.num_points);
    c.cx = static_cast<float>(sx / n);
    c.cy = static_cast<float>(sy / n);
    c.cz = static_cast<float>(sz / n);
    out.push_back(c);
  }

  std::sort(out.begin(), out.end(),
    [](const Cluster & a, const Cluster & b) {return a.range < b.range;});
  return out;
}

}  // namespace adas_perception
