// Phase 2A — Euclidean clustering for LiDAR obstacle detection.
#ifndef ADAS_PERCEPTION__CLUSTERING_HPP_
#define ADAS_PERCEPTION__CLUSTERING_HPP_

#include <vector>

#include <pcl/point_cloud.h>
#include <pcl/point_types.h>

namespace adas_perception
{

struct Cluster
{
  float cx{0.0f}, cy{0.0f}, cz{0.0f};          // centroid
  float min_x{0.0f}, max_x{0.0f};
  float min_y{0.0f}, max_y{0.0f};
  float min_z{0.0f}, max_z{0.0f};
  float range{0.0f};                            // nearest point, XY plane
  std::size_t num_points{0};
};

/// Euclidean cluster extraction (PCL KdTree) over a pre-filtered cloud.
std::vector<Cluster> euclidean_cluster(
  const pcl::PointCloud<pcl::PointXYZ>::ConstPtr & cloud,
  double tolerance_m,
  int min_points,
  int max_points);

}  // namespace adas_perception

#endif  // ADAS_PERCEPTION__CLUSTERING_HPP_
