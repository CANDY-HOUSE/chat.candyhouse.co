# [candyhouseAI](https://chat.candyhouse.co/)
💡💡💡💡💡💡💡💡💡💡💡💡💡

# 项目结构
     ├── .github/workflows/       # GitHub Actions 工作流配置目录 | GitHub Actions configuration
     ├── public/                  # 静态资源文件目录 | Static resources
     └── src/                     # 源代码目录 | Source code
         ├── api/                 # API 相关代码 | API related code
         ├── assets/              # 图片、文字等静态资源
         ├── components/          # 可复用组件
         ├── config/              # 配置文件 | Configuration
         ├── constants/           # 全局常量
         ├── context/             # 全局状态 | Global state
         ├── features/            # 领域/功能组件
         ├── hooks/               # React hooks
         ├── i18n/                # 国际化 | Internationalization
         ├── pages/               # 页面组件 | Page components
         ├── router/              # 路由配置 | Router configuration
         ├── services/            # ai service
         ├── store/               # 状态管理 | State management
         ├── styles/              # 全局样式
         ├── types/               # TypeScript 类型定义 | TypeScript definitions
         ├── utils/               # 工具函数 | Utilities
         ├── App.css              # 应用根组件样式文件 | Root component styles
         ├── App.tsx              # 应用根组件 | Root component
         ├── index.tsx            # 应用入口文件 | Application entry
         └── reportWebVitals.ts   # Web性能监控工具 | Web performance monitoring


# 根目录文件 | Root files
    ├── .env.dev             # 开发环境配置 | Development environment config
    ├── .env.prod            # 生产环境配置 | Production environment config
    ├── .gitignore           # Git忽略文件配置 | Git ignore configuration
    ├── craco.config.js      # Craco配置文件
    ├── eslint.config.js     # ESLint配置文件 | ESLint configuration
    ├── generate-version.js  # 版本生成脚本 | Version generation script
    ├── package.json         # 项目依赖配置 | Project dependencies
    ├── package-lock.json    # 包版本锁定文件 | Package version lock
    ├── README.md            # 项目说明文档 | Project documentation
    └── tsconfig.json        # TypeScript配置文件 | TypeScript configuration


# 项目启动配置

## 开发环境
```bash
# 安装依赖
npm i

# 开发环境启动
npm run start    # 使用 .env.dev 配置启动项目

# 生产环境启动
npm run prod      # 使用 .env.prod 配置启动项目

# 项目构建
npm run build      # 构建生产环境代码
npm run prebuild   # 生成版本信息

# 代码检查
npm run lint       # 运行 ESLint 检查
npm run lint:fix   # 自动修复 ESLint 问题
```
