# 资治通鉴历史数据可视化系统

一个基于 React + TypeScript + Vite 构建的历史数据可视化系统，用于展示《资治通鉴》中的历史事件、人物关系和势力分布。

## 功能特性

### 📅 时间轴视图
- 展示历史事件按时间顺序排列
- 支持点击查看事件详情
- 可视化事件与时间的关系

### 🔗 人物关系网络图
- D3.js 力导向图展示人物间的互动关系
- 节点大小表示出现频率
- 颜色区分不同势力
- 支持拖拽交互和缩放

### 📊 势力分布图
- 柱状图展示各势力的人物数量
- 直观了解各方势力对比

### 📍 地点列表
- 展示所有出现的历史地点
- 包含古今地名对照

### 🎛️ 筛选功能
- **卷范围筛选**: 选择要查看的卷数范围（卷1到卷294）
- **时间范围筛选**: 按公元前年份筛选
- **快速筛选**: 预设的常用筛选条件

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **可视化**: D3.js
- **数据格式**: JSON

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 数据结构

系统读取 `public/data/` 目录下的 JSON 数据文件:

- `juan_*.json`: 各卷提取的历史数据
- `metadata.json`: 元数据信息

每个提取记录包含:
- **entities** (实体/人物): 名称、别名、势力、描述
- **events** (事件): 名称、时间、地点、参与者、描述、意义
- **relations** (关系/行为): 主体、客体、行为、背景、结果
- **locations** (地点): 名称、类型、现代地名、坐标

## 项目结构

```
src/
├── components/          # 可视化组件
│   ├── Timeline.tsx     # 时间轴组件
│   ├── NetworkGraph.tsx # 关系网络图
│   ├── PowerChart.tsx   # 势力分布图
│   ├── FilterControls.tsx # 筛选控件
│   └── DetailPanels.tsx # 详情面板
├── hooks/
│   └── useData.ts       # 数据加载 Hook
├── types/
│   └── index.ts         # TypeScript 类型定义
├── utils/
│   └── dataProcessing.ts # 数据处理工具
├── App.tsx              # 主应用组件
└── main.tsx             # 入口文件
```

## 许可证

MIT
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
