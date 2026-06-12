// Phase 2A — LiDAR perception node.
//
// Subscribes: /carla/ego_vehicle/lidar   (sensor_msgs/PointCloud2)
// Publishes:  /adas/obstacles            (visualization_msgs/MarkerArray)  rviz cubes
//             /adas/nearest_obstacle     (std_msgs/Float32MultiArray)
//                                        [range_m, closing_speed_mps, x, y]
//                                        range = -1 when no in-lane obstacle
//
// Pipeline: crop box (ahead of ego, ground + sky removed) → voxel downsample
// → Euclidean clustering → nearest in-lane cluster → range-rate tracking
// (EMA-smoothed closing speed for the planning FSM's TTC).
#include <cmath>
#include <memory>
#include <string>
#include <vector>

#include <pcl/filters/crop_box.h>
#include <pcl/filters/voxel_grid.h>
#include <pcl_conversions/pcl_conversions.h>

#include <rclcpp/rclcpp.hpp>
#include <sensor_msgs/msg/point_cloud2.hpp>
#include <std_msgs/msg/float32_multi_array.hpp>
#include <visualization_msgs/msg/marker_array.hpp>

#include "adas_perception/clustering.hpp"

using adas_perception::Cluster;

class PerceptionNode : public rclcpp::Node
{
public:
  PerceptionNode()
  : Node("perception_node")
  {
    cluster_tolerance_ = declare_parameter("cluster_tolerance", 0.7);
    min_cluster_size_ = static_cast<int>(declare_parameter("min_cluster_size", 8));
    max_cluster_size_ = static_cast<int>(declare_parameter("max_cluster_size", 5000));
    range_max_ = declare_parameter("range_max", 60.0);
    lane_half_width_ = declare_parameter("lane_half_width", 1.5);
    voxel_leaf_ = declare_parameter("voxel_leaf", 0.2);
    z_min_ = declare_parameter("z_min", -1.9);   // sensor 2.4 m up → drops ground
    z_max_ = declare_parameter("z_max", 1.0);
    ema_alpha_ = declare_parameter("ema_alpha", 0.4);
    track_reset_jump_m_ = declare_parameter("track_reset_jump_m", 5.0);

    lidar_sub_ = create_subscription<sensor_msgs::msg::PointCloud2>(
      "/carla/ego_vehicle/lidar", rclcpp::SensorDataQoS(),
      [this](const sensor_msgs::msg::PointCloud2::SharedPtr msg) {on_lidar(msg);});
    markers_pub_ = create_publisher<visualization_msgs::msg::MarkerArray>(
      "/adas/obstacles", 10);
    nearest_pub_ = create_publisher<std_msgs::msg::Float32MultiArray>(
      "/adas/nearest_obstacle", 10);

    RCLCPP_INFO(
      get_logger(), "PerceptionNode ready (tol=%.2fm, lane ±%.1fm, range %.0fm)",
      cluster_tolerance_, lane_half_width_, range_max_);
  }

private:
  void on_lidar(const sensor_msgs::msg::PointCloud2::SharedPtr msg)
  {
    auto cloud = pcl::PointCloud<pcl::PointXYZ>::Ptr(
      new pcl::PointCloud<pcl::PointXYZ>());
    pcl::fromROSMsg(*msg, *cloud);
    if (cloud->empty()) {
      publish_nearest(msg, -1.0f, 0.0f, 0.0f, 0.0f);
      return;
    }

    // 1. Crop: forward sector, ground/sky removed.
    auto cropped = pcl::PointCloud<pcl::PointXYZ>::Ptr(
      new pcl::PointCloud<pcl::PointXYZ>());
    pcl::CropBox<pcl::PointXYZ> crop;
    crop.setInputCloud(cloud);
    crop.setMin(Eigen::Vector4f(0.5f, -8.0f, static_cast<float>(z_min_), 1.0f));
    crop.setMax(Eigen::Vector4f(
        static_cast<float>(range_max_), 8.0f, static_cast<float>(z_max_), 1.0f));
    crop.filter(*cropped);

    // 2. Voxel downsample (keeps clustering O(n²)-safe at 1.3M pts/s).
    auto down = pcl::PointCloud<pcl::PointXYZ>::Ptr(
      new pcl::PointCloud<pcl::PointXYZ>());
    pcl::VoxelGrid<pcl::PointXYZ> voxel;
    voxel.setInputCloud(cropped);
    const auto leaf = static_cast<float>(voxel_leaf_);
    voxel.setLeafSize(leaf, leaf, leaf);
    voxel.filter(*down);

    // 3. Cluster.
    const auto clusters = adas_perception::euclidean_cluster(
      down, cluster_tolerance_, min_cluster_size_, max_cluster_size_);

    // 4. Nearest in-lane cluster (clusters are sorted by range).
    const Cluster * nearest = nullptr;
    for (const auto & c : clusters) {
      if (std::abs(c.cy) <= lane_half_width_) {
        nearest = &c;
        break;
      }
    }

    publish_markers(msg, clusters, nearest);

    if (nearest == nullptr) {
      has_track_ = false;
      publish_nearest(msg, -1.0f, 0.0f, 0.0f, 0.0f);
      return;
    }

    // 5. Range-rate tracking → closing speed (+ve = approaching).
    const double stamp_s = rclcpp::Time(msg->header.stamp).seconds();
    float closing = 0.0f;
    if (has_track_) {
      const double dt = stamp_s - prev_stamp_s_;
      const double jump = std::abs(nearest->range - prev_range_);
      if (dt > 1e-4 && jump < track_reset_jump_m_) {
        const double raw = (prev_range_ - nearest->range) / dt;
        closing_ema_ = ema_alpha_ * raw + (1.0 - ema_alpha_) * closing_ema_;
        closing = static_cast<float>(closing_ema_);
      } else if (jump >= track_reset_jump_m_) {
        closing_ema_ = 0.0;  // new object — restart the filter
      }
    } else {
      closing_ema_ = 0.0;
    }
    prev_range_ = nearest->range;
    prev_stamp_s_ = stamp_s;
    has_track_ = true;

    publish_nearest(msg, nearest->range, closing, nearest->cx, nearest->cy);
  }

  void publish_nearest(
    const sensor_msgs::msg::PointCloud2::SharedPtr & /*msg*/,
    float range, float closing, float x, float y)
  {
    std_msgs::msg::Float32MultiArray out;
    out.data = {range, closing, x, y};
    nearest_pub_->publish(out);
  }

  void publish_markers(
    const sensor_msgs::msg::PointCloud2::SharedPtr & msg,
    const std::vector<Cluster> & clusters,
    const Cluster * nearest)
  {
    visualization_msgs::msg::MarkerArray arr;
    visualization_msgs::msg::Marker clear;
    clear.header = msg->header;
    clear.ns = "obstacles";
    clear.action = visualization_msgs::msg::Marker::DELETEALL;
    arr.markers.push_back(clear);

    int id = 0;
    for (const auto & c : clusters) {
      visualization_msgs::msg::Marker m;
      m.header = msg->header;
      m.ns = "obstacles";
      m.id = id++;
      m.type = visualization_msgs::msg::Marker::CUBE;
      m.action = visualization_msgs::msg::Marker::ADD;
      m.pose.position.x = c.cx;
      m.pose.position.y = c.cy;
      m.pose.position.z = c.cz;
      m.pose.orientation.w = 1.0;
      m.scale.x = std::max(0.3f, c.max_x - c.min_x);
      m.scale.y = std::max(0.3f, c.max_y - c.min_y);
      m.scale.z = std::max(0.3f, c.max_z - c.min_z);
      const bool is_nearest = (nearest == &c);
      m.color.r = 1.0f;
      m.color.g = is_nearest ? 0.1f : 0.6f;
      m.color.b = 0.1f;
      m.color.a = is_nearest ? 0.9f : 0.5f;
      m.lifetime = rclcpp::Duration::from_seconds(0.2);
      arr.markers.push_back(m);
    }
    markers_pub_->publish(arr);
  }

  // params
  double cluster_tolerance_, range_max_, lane_half_width_, voxel_leaf_;
  double z_min_, z_max_, ema_alpha_, track_reset_jump_m_;
  int min_cluster_size_, max_cluster_size_;

  // track state
  bool has_track_{false};
  double prev_range_{0.0}, prev_stamp_s_{0.0}, closing_ema_{0.0};

  rclcpp::Subscription<sensor_msgs::msg::PointCloud2>::SharedPtr lidar_sub_;
  rclcpp::Publisher<visualization_msgs::msg::MarkerArray>::SharedPtr markers_pub_;
  rclcpp::Publisher<std_msgs::msg::Float32MultiArray>::SharedPtr nearest_pub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<PerceptionNode>());
  rclcpp::shutdown();
  return 0;
}
