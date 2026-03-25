---
name: mock-interview-designer
description: 设计模拟面试场景和 AI Prompt 模板。当用户提到设计面试流程、面试场景、面试 Prompt、模拟面试配置时使用此技能。
---

# 模拟面试设计

## 触发场景
- 用户要求设计面试流程
- 用户要求创建面试 Prompt
- 用户要求配置面试场景（不同岗位/难度）

## 面试场景模板

### 岗位配置

每个岗位对应一个 JSON 配置文件，存放在 `backend/app/services/interview_configs/`：

```json
{
  "position": "后端开发",
  "company_level": "大厂",
  "difficulty": "中等",
  "duration_minutes": 45,
  "stages": [
    {"name": "自我介绍", "duration": 2, "prompt_key": "self_intro"},
    {"name": "项目经历", "duration": 10, "prompt_key": "project_deep_dive"},
    {"name": "八股文", "duration": 15, "prompt_key": "knowledge_qa", "topics": ["java", "database", "os"]},
    {"name": "算法", "duration": 15, "prompt_key": "algorithm"},
    {"name": "反问", "duration": 3, "prompt_key": "reverse_qa"}
  ]
}
```

### 可用岗位模板

| 岗位 | 重点方向 | 配置文件 |
|------|---------|---------|
| 后端开发 | Java/Go + 数据库 + 系统设计 | `backend-dev.json` |
| 前端开发 | JS/TS + React + 浏览器 + 网络 | `frontend-dev.json` |
| 算法工程师 | ML/DL + 数学 + 编程 | `algorithm-engineer.json` |
| 数据开发 | SQL + 大数据 + 分布式 | `data-engineer.json` |

## AI Prompt 设计原则

### System Prompt 结构
```
你是{company}的{position}面试官，有{years}年经验。
当前面试阶段：{stage}
候选人水平：{level}

行为准则：
- 严格但友善，营造真实面试氛围
- 不直接给答案，通过追问引导思考
- 根据回答质量动态调整难度
- 每个问题等待回答后再追问
```

### 追问 Prompt 策略
```
回答质量判断：
- 优秀（关键词命中 > 80%）→ 追问底层原理或边界情况
- 一般（关键词命中 40-80%）→ 换角度提问，给予方向性提示
- 较差（关键词命中 < 40%）→ 简化问题，引导回基础概念
```

## 创建新面试场景的流程
1. 确定岗位和目标公司级别
2. 选择重点考察方向（从知识库分类中选取）
3. 按模板创建配置 JSON
4. 编写各阶段的 System Prompt
5. 设置追问策略和评分标准
