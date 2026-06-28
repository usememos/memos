# Streak 功能实现总结

## ✅ 已完成的工作

### 1. Proto 定义扩展
**文件:** [proto/api/v1/user_service.proto](proto/api/v1/user_service.proto)

#### 添加的内容：
- 在 `UserStats` 消息中添加了 `StreakStats` 字段（field 9）
- 在 `GetUserStatsRequest` 中添加了 `timezone_offset_minutes` 参数（field 2）
- 新增 `StreakStats` 嵌套消息，包含：
  - `current_streak`: 当前连续打卡天数
  - `longest_streak`: 历史最高连续天数
  - `last_active_date`: 最后活跃日期（格式：YYYY-MM-DD）

```protobuf
message StreakStats {
  int32 current_streak = 1;
  int32 longest_streak = 2;
  string last_active_date = 3;
}
```

### 2. 后端算法实现
**文件:** [server/router/api/v1/user_service_streak.go](server/router/api/v1/user_service_streak.go)

#### 核心函数：

**`CalculateUserStreak(ctx, userID, timezoneOffsetMinutes)`**
- 查询用户所有 `NORMAL` 状态的 Memo
- 根据时区偏移量将 Unix 时间戳转换为本地日期
- 对日期进行去重和降序排序
- 调用子函数计算当前和最长连续天数

**`calculateCurrentStreak(sortedDates, timezoneOffsetMinutes)`**
- 从今天（或昨天，如果今天未打卡）开始向前回溯
- 计算连续的天数序列
- 如果最后活动超过 1 天前，则当前 Streak 为 0

**`calculateLongestStreak(sortedDates)`**
- 遍历整个日期数组
- 查找最长的连续日期子序列
- 返回历史最高连续天数

#### 时区处理逻辑：
```go
timezoneOffset := time.Duration(timezoneOffsetMinutes) * time.Minute
utcTime := time.Unix(memo.CreatedTs, 0).UTC()
localTime := utcTime.Add(timezoneOffset)
dateStr := localTime.Format("2006-01-02")
```

### 3. 集成到现有 API
**文件:** [server/router/api/v1/user_service_stats.go](server/router/api/v1/user_service_stats.go)

#### 修改内容：
- 在 `GetUserStats` 函数中添加了 Streak 计算调用
- 预留了时区偏移量参数（待 proto 重新生成后启用）
- 添加了 TODO 注释，标记了需要在 proto 重新生成后取消注释的代码

### 4. 完整的测试套件
**文件:** [server/router/api/v1/user_service_streak_test.go](server/router/api/v1/user_service_streak_test.go)

#### 测试覆盖：
✅ **基础功能测试**
- 空日期列表
- 单日活动
- 连续 5 天打卡
- 连续天数但最后活动在昨天
- 中断的 Streak

✅ **边界情况测试**
- 跨月边界（5月 → 6月）
- 跨年边界（12月 → 1月）
- 闰年处理（2024年2月29日）
- 30天和365天长期 Streak

✅ **时区处理测试**
- 验证同一 UTC 时间戳在不同时区映射到不同本地日期
- 边界情况：UTC 23:30 在 UTC+8 变为次日

#### 测试结果：
```
=== All Tests PASSED ===
- TestCalculateCurrentStreak: 6/6 cases passed
- TestCalculateLongestStreak: 8/8 cases passed
- TestTimezoneHandling: passed
- TestStreakEdgeCases: 2/2 cases passed

✅ Race detector: PASS
```

---

## 🔄 待完成的步骤

### 步骤 1: 重新生成 Proto 文件
需要在有 `buf` 工具链的环境中执行：

```bash
cd proto
buf generate
```

这将生成：
- Go 类型定义（`proto/gen/api/v1/user_service.pb.go`）
- TypeScript 类型（`web/src/types/proto/api/v1/user_service_pb.ts`）
- OpenAPI 规范

### 步骤 2: 启用后端代码中的 Streak 字段
在 [server/router/api/v1/user_service_stats.go:210-213](server/router/api/v1/user_service_stats.go#L210-L213) 中：

**取消注释以下代码：**
```go
// 第 210 行：启用时区参数
timezoneOffsetMinutes := request.TimezoneOffsetMinutes

// 第 294-299 行：启用 StreakStats 字段
StreakStats: &v1pb.UserStats_StreakStats{
    CurrentStreak:  streakStats.CurrentStreak,
    LongestStreak:  streakStats.LongestStreak,
    LastActiveDate: streakStats.LastActiveDate,
},
```

**删除临时代码：**
```go
// 删除第 303 行
_ = streakStats // Suppress unused variable warning
```

### 步骤 3: 前端实现（下一阶段）

#### 3.1 创建 Streak Badge 组件
**文件:** `web/src/components/StreakBadge.tsx`

```tsx
interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
}

export function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;
  
  return (
    <div className="streak-badge">
      <span className="streak-icon">🔥</span>
      <span className="streak-count">{currentStreak}</span>
      <Tooltip content={`历史最高: ${longestStreak} 天`} />
    </div>
  );
}
```

#### 3.2 在 API 调用中传递时区偏移量
```typescript
const timezoneOffsetMinutes = -new Date().getTimezoneOffset();
const stats = await getUserStats(username, timezoneOffsetMinutes);
```

#### 3.3 UI 集成位置
建议在以下位置展示 Streak Badge：
- 侧边栏用户信息区域
- 用户个人资料页面
- 顶部导航栏（可选）

#### 3.4 视觉增强（可选）
- 当 `currentStreak >= 7` 时，添加渐变色效果
- 当 `currentStreak >= 30` 时，添加脉冲动画
- 当 `currentStreak === longestStreak` 时，显示"🏆 新纪录！"

---

## 📊 API 使用示例

### 请求示例
```http
GET /api/v1/users/steven:getStats?timezone_offset_minutes=480
```

参数说明：
- `timezone_offset_minutes=480`: UTC+8 时区（中国标准时间）
- `timezone_offset_minutes=-300`: UTC-5 时区（美国东部标准时间）
- `timezone_offset_minutes=0`: UTC 时区

### 响应示例
```json
{
  "name": "users/steven/stats",
  "totalMemoCount": 156,
  "streakStats": {
    "currentStreak": 12,
    "longestStreak": 45,
    "lastActiveDate": "2026-06-28"
  },
  "tagCount": {...},
  "memoTypeStats": {...}
}
```

---

## 🔍 算法说明

### 打卡规则
- ✅ **有效打卡:** 在一个自然日内创建至少一条 `NORMAL` 状态的 Memo
- ❌ **不计入:** `ARCHIVED` 状态的 Memo
- ❌ **不计入:** 评论（comments）

### Current Streak 计算逻辑
1. 获取用户时区的"今天"日期
2. 检查最后活动日期：
   - 如果是今天 → 从今天开始计数
   - 如果是昨天 → 从昨天开始计数（Streak 仍然有效）
   - 如果超过1天 → Streak 已中断，返回 0
3. 向前回溯，计算连续天数，遇到间隔则停止

### Longest Streak 计算逻辑
1. 遍历所有打卡日期（降序排列）
2. 查找最长的连续日期子序列
3. 返回历史上出现过的最大连续天数

### 时区边界处理
**示例:** 用户在 UTC+8 时区

| UTC 时间 | UTC+8 本地时间 | 计入日期 |
|---------|---------------|---------|
| 2026-06-27 23:30 | 2026-06-28 07:30 | 2026-06-28 |
| 2026-06-28 01:00 | 2026-06-28 09:00 | 2026-06-28 |
| 2026-06-28 16:00 | 2026-06-29 00:00 | 2026-06-29 |

同一日期的多条 Memo 只计为一次打卡。

---

## 🧪 验证清单

- [x] Proto 定义已扩展
- [x] 核心算法实现完成
- [x] 集成到 `GetUserStats` API
- [x] 单元测试全部通过（16个测试用例）
- [x] Race detector 测试通过
- [x] 跨月边界测试通过
- [x] 跨年边界测试通过
- [x] 闰年处理测试通过
- [x] 时区处理测试通过
- [ ] Proto 文件重新生成（需要 buf 工具）
- [ ] 前端组件实现
- [ ] 端到端测试

---

## 📝 后续优化建议

### 1. 性能优化（可选）
如果用户 Memo 数量非常大（>10,000条），可以考虑：
- 在 `user_setting` 表中缓存 Streak 结果
- 仅在创建新 Memo 时增量更新 Streak
- 添加后台任务定期重新计算

### 2. 功能扩展（未来版本）
- 支持按标签筛选打卡（如：只统计包含 `#每日复盘` 的 Memo）
- 添加打卡日历热力图可视化
- 支持自定义打卡规则（如：每天至少 N 条 Memo）
- 添加 Streak 里程碑徽章（7天、30天、100天等）
- 社交功能：查看好友的 Streak 排行榜

### 3. 数据迁移（如果需要）
当前实现是实时计算，无需数据迁移。如果未来选择缓存方案，需要：
1. 添加数据库迁移脚本
2. 为所有现有用户初始化 Streak 缓存
3. 添加缓存失效和重建机制

---

## 🐛 已知限制

1. **Proto 重新生成:** 需要在有 `buf` 工具的环境中执行
2. **默认时区:** 当前代码中临时使用 UTC（offset=0），前端传参后将修复
3. **性能考量:** 对于拥有大量 Memo 的用户，首次计算可能需要几百毫秒

---

## 📚 相关文件清单

| 文件 | 状态 | 说明 |
|-----|------|------|
| `proto/api/v1/user_service.proto` | ✅ 已修改 | Proto 定义 |
| `server/router/api/v1/user_service_streak.go` | ✅ 新增 | Streak 算法核心 |
| `server/router/api/v1/user_service_streak_test.go` | ✅ 新增 | 完整测试套件 |
| `server/router/api/v1/user_service_stats.go` | ✅ 已修改 | 集成到现有 API |
| `proto/gen/api/v1/user_service.pb.go` | ⏳ 待生成 | Go proto 代码 |
| `web/src/types/proto/api/v1/user_service_pb.ts` | ⏳ 待生成 | TypeScript proto 代码 |
| `web/src/components/StreakBadge.tsx` | ⏳ 待实现 | 前端 Streak 组件 |

---

## 📞 下一步行动

请确认后端算法实现是否符合预期，然后我们可以继续：

1. **如果您有 buf 工具:** 执行 `cd proto && buf generate` 重新生成 proto 文件
2. **如果没有 buf 工具:** 我可以提供手动修改生成文件的方案（不推荐）
3. **确认后端实现:** 我们可以进入前端组件开发阶段

---

**实现者:** Claude Opus 4.8  
**日期:** 2026-06-28  
**版本:** v1.0 (后端算法完成)
