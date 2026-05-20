#!/usr/bin/env python3
"""
Damplan Skill - 数据调研脚本
执行5个阶段的数据获取任务
"""

import os
import sys
import json
from datetime import datetime

def create_research_dirs():
    """创建研究数据目录"""
    base_dir = "/root/.openclaw/workspace/research_data"
    os.makedirs(base_dir, exist_ok=True)
    print(f"✓ 创建目录: {base_dir}")
    return base_dir

def init_data_files(base_dir):
    """初始化数据文件"""
    files = {
        "phase1_industry_data.md": "# 市场研究报告数据汇总\n\n> 数据来源：艾瑞咨询、IDC、Gartner、贝哲斯、Fortune Business Insights、易观、产业调研网、共研咨询等\n> 调研时间：{date}\n\n---\n\n",
        "phase2_competitor_data.md": "# 竞品数据汇总\n\n> 调研厂商：华栖云、索贝、大洋、米穗科技\n> 调研时间：{date}\n\n---\n\n",
        "phase3_enterprise_mam_data.md": "# 企业媒资数据汇总\n\n> 搜索关键词：企业数字化营销 媒资\n> 调研时间：{date}\n\n---\n\n",
        "phase3_enterprise_summary.md": "# 企业市场汇总表格\n\n> 生成方式：基于phase3_enterprise_mam_data.md按目标用户类型合并汇总\n> 用途：供'2.2.1 企业市场核心痛点'小节使用\n> 生成时间：{date}\n\n---\n\n| 目标用户类型 | 用户痛点 | 使用功能 | 用户收益 | 产品提供商 | 产品价格 |\n|-------------|---------|---------|---------|-----------|---------|\n",
        "phase4_government_mam_data.md": "# 政府媒资数据汇总\n\n> 搜索关键词：博物馆 媒资、文旅 媒资、公安 媒资、教委 媒资、档案馆 媒资\n> 调研时间：{date}\n\n---\n\n",
        "phase4_government_summary.md": "# 政府市场汇总表格\n\n> 生成方式：基于phase4_government_mam_data.md按目标用户类型合并汇总\n> 用途：供'2.2.2 政府市场核心痛点'小节使用\n> 生成时间：{date}\n\n---\n\n| 目标用户类型 | 用户痛点 | 使用功能 | 用户收益 | 产品提供商 | 产品价格 |\n|-------------|---------|---------|---------|-----------|---------|\n",
        "phase5_bidding_data.md": "# 招投标数据汇总\n\n> 数据来源：中国政府采购网、剑鱼标讯、采招网\n> 调研时间：{date}\n\n---\n\n"
    }

    date_str = datetime.now().strftime("%Y-%m-%d")
    for filename, content in files.items():
        filepath = os.path.join(base_dir, filename)
        if not os.path.exists(filepath):
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content.format(date=date_str))
            print(f"✓ 初始化文件: {filename}")
        else:
            print(f"  文件已存在: {filename}")

def check_progress(base_dir):
    """检查数据收集进度"""
    files = [
        "phase1_industry_data.md",
        "phase2_competitor_data.md",
        "phase3_enterprise_mam_data.md",
        "phase3_enterprise_summary.md",
        "phase4_government_mam_data.md",
        "phase4_government_summary.md",
        "phase5_bidding_data.md"
    ]

    print("\n📊 数据收集进度:")
    print("-" * 50)
    for i, filename in enumerate(files, 1):
        filepath = os.path.join(base_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                # 统计条目数量（简单统计"## "出现的次数）
                count = content.count("## ")
                status = f"✓ ({count} 条数据)"
        else:
            status = "✗ (未开始)"
        print(f"Step {i}: {filename:<35} {status}")
    print("-" * 50)

def main():
    print("=" * 60)
    print("Damplan Skill - 数据调研初始化")
    print("=" * 60)

    base_dir = create_research_dirs()
    init_data_files(base_dir)
    check_progress(base_dir)

    print("\n✓ 初始化完成！")
    print(f"数据目录: {base_dir}")
    print("\n下一步：开始执行5个阶段的数据调研任务")

if __name__ == "__main__":
    main()
