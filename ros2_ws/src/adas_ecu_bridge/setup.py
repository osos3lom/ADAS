from setuptools import find_packages, setup

package_name = "adas_ecu_bridge"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
    ],
    install_requires=["setuptools", "requests"],
    zip_safe=True,
    maintainer="ADAS Team",
    maintainer_email="osama.aalam@gmail.com",
    description="Phase 3A — ROS2 → UDS bridge: maps CARLA events to P1Cxx DTCs via backend REST",
    license="MIT",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "ecu_bridge_node = adas_ecu_bridge.ecu_bridge_node:main",
        ],
    },
)
