from setuptools import find_packages, setup

package_name = "adas_planning"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
        (f"share/{package_name}/launch", ["launch/planning.launch.py"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="ADAS Team",
    maintainer_email="osama.aalam@gmail.com",
    description="Phase 2B — AEB/LDW/ACC FSM policy nodes",
    license="MIT",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "planning_node = adas_planning.planning_node:main",
        ],
    },
)
