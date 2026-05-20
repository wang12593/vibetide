#!/usr/bin/env python3
"""
验证Skill结构完整性
"""

import os
import sys

def validate_skill(skill_path):
    """验证Skill结构"""
    errors = []
    warnings = []
    
    # 检查SKILL.md
    skill_md = os.path.join(skill_path, "SKILL.md")
    if not os.path.exists(skill_md):
        errors.append("缺少 SKILL.md 文件")
    else:
        with open(skill_md, 'r', encoding='utf-8') as f:
            content = f.read()
            if "---" not in content:
                errors.append("SKILL.md 缺少 YAML frontmatter")
            if "name:" not in content:
                errors.append("SKILL.md 缺少 name 字段")
            if "description:" not in content:
                errors.append("SKILL.md 缺少 description 字段")
    
    # 检查references
    refs_dir = os.path.join(skill_path, "references")
    if os.path.exists(refs_dir):
        refs = os.listdir(refs_dir)
        if not refs:
            warnings.append("references/ 目录为空")
    
    # 检查scripts
    scripts_dir = os.path.join(skill_path, "scripts")
    if os.path.exists(scripts_dir):
        scripts = os.listdir(scripts_dir)
        for script in scripts:
            if script.endswith('.py'):
                # 检查是否可执行
                filepath = os.path.join(scripts_dir, script)
                if not os.access(filepath, os.X_OK):
                    warnings.append(f"脚本 {script} 可能缺少执行权限")
    
    return errors, warnings

def validate_data_files(skill_path):
    """验证数据文件是否存在且格式正确"""
    errors = []
    warnings = []
    
    base_dir = "/root/.openclaw/workspace/research_data"
    
    # 定义必需的数据文件
    required_files = [
        "phase1_industry_data.md",
        "phase2_competitor_data.md",
        "phase3_enterprise_mam_data.md",
        "phase3_enterprise_summary.md",
        "phase4_government_mam_data.md",
        "phase4_government_summary.md",
        "phase5_bidding_data.md"
    ]
    
    print("\n📊 数据文件检查:")
    print("-" * 50)
    
    for filename in required_files:
        filepath = os.path.join(base_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                # 统计条目数量
                count = content.count("## ")
                # 检查是否包含表格（针对汇总文件）
                has_table = "| 目标用户类型 |" in content
                
                if "summary" in filename and not has_table:
                    warnings.append(f"{filename} 可能缺少汇总表格")
                
                status = f"✓ ({count} 条数据)"
                if "summary" in filename and has_table:
                    status += " [含汇总表格]"
        else:
            status = "✗ (文件不存在)"
            errors.append(f"缺少数据文件: {filename}")
        
        print(f"  {filename:<35} {status}")
    
    print("-" * 50)
    
    return errors, warnings

def main():
    skill_path = "/root/.openclaw/workspace/skills/damplan"
    print("验证 Skill: damplan")
    print("=" * 50)
    
    errors, warnings = validate_skill(skill_path)
    data_errors, data_warnings = validate_data_files(skill_path)
    
    errors.extend(data_errors)
    warnings.extend(data_warnings)
    
    if errors:
        print("\n❌ 错误:")
        for e in errors:
            print(f"  - {e}")
    
    if warnings:
        print("\n⚠️ 警告:")
        for w in warnings:
            print(f"  - {w}")
    
    if not errors and not warnings:
        print("\n✓ Skill 结构和数据文件验证通过！")
    elif not errors:
        print("\n✓ Skill 结构基本正确（有警告）")
    else:
        print("\n✗ Skill 结构有问题，请修复")
        sys.exit(1)

if __name__ == "__main__":
    main()
