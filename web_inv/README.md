# Getting Started with Create React App

src/
├── api/                 # API 层 - 数据获取
├── assets/              # 静态资源 - 图片资源丰富
├── components/          # 组件层 - 大量业务组件
├── context/             # 状态管理 - 各模块的 Context
├── css/                 # 样式文件 - 模块化 CSS
├── layouts/             # 布局组件 - 页面骨架
├── lib/                 # 工具库 - 第三方服务集成
├── routes/              # 路由配置
├── types/               # TypeScript 类型定义
├── views/               # 视图层 - 页面组件
├── config.ts            # 配置文件
├── main.tsx             # 入口文件
└── App.tsx              # 根组件


src/features/accounting/
├── domain/                          # 核心业务逻辑
│   ├── entities/
│   │   ├── Employee.ts              # 来自 types/employee.ts
│   │   └── Payroll.ts               # 来自 types/payroll.ts
│   └── rules/
│       └── PayrollCalculator.ts      # 新建（业务规则）
│
├── application/                      # 应用用例
│   ├── commands/
│   │   └── ProcessPayrollCommand.ts  # 新建
│   └── queries/
│       └── GetPayrollDataQuery.ts    # 新建
│
├── infrastructure/                   # 外部依赖
│   ├── api/
│   │   ├── payroll-api.ts           # 来自 api/accounting/payroll-api.ts
│   │   └── employee-api.ts           # 来自 api/employee/employee-api.ts
│   └── repositories/
│       └── PayrollRepository.ts      # 新建
│
└── presentation/                     # UI层
    ├── components/
    │   ├── PayrollTable/
    │   │   ├── index.tsx
    │   │   ├── PayrollDataTable.tsx     # 来自 components/accounting/PayrollDataTable.tsx
    │   │   ├── CheckboxTable.tsx        # 来自 components/accounting/CheckboxTable.tsx
    │   │   ├── HoverTable.tsx           # 来自 components/accounting/HoverTable.tsx
    │   │   └── StripedRowTable.tsx      # 来自 components/accounting/StripedRowTable.tsx
    │   ├── PayrollPeriod/
    │   │   └── PayrollPeriodManager.tsx # 来自 components/accounting/PayrollPeriodManager.tsx（合并两个）
    │   ├── EmployeeForm/
    │   │   └── EmployeeFormModal.tsx    # 来自 views/apps/accounting/EmployeeFormModal.tsx
    │   └── PayrollForm/
    │       └── PayrollForm.tsx          # 来自 views/apps/accounting/PayrollForm.tsx
    │
    ├── pages/
    │   ├── PayrollPage.tsx              # 来自 views/apps/accounting/Payroll.tsx
    │   └── index.ts                      # 导出页面
    │
    ├── hooks/
    │   ├── usePayrollData.ts             # 新建（从 context 提取逻辑）
    │   └── useEmployeeData.ts             # 新建
    │
    └── context/
        └── PayrollContext.tsx            # 来自 context/payroll-context/index.tsx

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).



先建最小 biz store，不接任何页面
改动文件：src/store/biz-store.ts（新建）
只放 3 个 state：activeBizId, loading, hydrated；2 个 action：setActiveBizId, reset；加 persist。
验收：打开控制台手动调用 useBizStore.getState().setActiveBizId('abc') 后刷新，值还在。


只替换右上角 ClientSwitcher 到 store
改动文件：src/_layouts/full/vertical/header/ClientSwitcher.tsx
先只做“读写 activeBizId”，暂时不动 clients 列表来源。
验收：UI 选中状态切换正确，刷新页面后仍保持。

把“切换 client 持久化后端”收口成 store action
改动文件：src/store/biz-store.ts
新增 switchClient(bizId)：先更新 store，再 clientsAPI.patchZbid。
改动 ClientSwitcher：onClick 改为 switchClient。
验收：切换后刷新、重新登录，后端 current biz 跟随变化。

把 clients 列表和 refreshClients 加进 store
改动文件：src/store/biz-store.ts
加 clients, refreshClients()，并在 refreshClients 内做 activeBiz 校验。
验收：ClientSwitcher 和 Clients 页面显示一致，空列表/删除场景不崩。

只替换 AuthLogin
改动文件：src/_authentication/authforms/AuthLogin.tsx
登录成功后调用 bizStore.refreshClients()，不再依赖 context。
验收：登录后首页能拿到 active client，header 显示正确。

只替换 Clients.tsx
改动文件：src/_settings/clients/Clients.tsx
把 useBiz() 改为 useBizStore()。
验收：勾选切换、新增、删除后 active client 行为正确。

替换业务依赖点
改动文件：src/_settings/employees/useEmployees.ts, src/accounting/PayrollEntry.tsx 等
全部从 store 读 activeBizId。
验收：不同模块切换 client 后数据同步刷新。

删除 context
改动文件：src/context/context_biz.tsx, src/App.tsx, 所有 useBiz 引用
移除 BizProvider 和 useBiz。
验收：全站编译通过，rg -n "useBiz|BizProvider|context_biz" src 无结果。


执行规则（防翻车）

每一步只改 1-2 个文件。
每一步完成后立刻手测：登录、切换 client、刷新页面、登出再登录。
每一步都留可回退点（单独 commit）。
otally — here are example queries that reliably hit each route.

SQL

“Total net pay for January 2026”
“Average gross pay by employee for Q1 2026”
“Count of payroll records in February 2026”
RAG_QA

“What was John Doe’s hourly rate snapshot during the last pay period?”
“Explain the bonus and tax values in the latest payroll history entry for Alice.”
“What does the payroll history say about overtime hours last month?”
RAG_SUMMARY

“Summarize payroll trends for Q1 2026”
“Give me a summary of deductions and net pay for the past 6 months”
“Overall payroll cost summary for 2025”
WEB_SEARCH

“What’s the current CPP contribution rate in Canada?”
“Latest EI maximum insurable earnings 2026”
“Ontario payroll tax updates this year”
DIRECT

“How do payroll deductions generally work?”
“What’s the difference between gross and net pay?”
“Give me best practices for payroll audits”
If you want me to hardcode route examples in a /agent/examples endpoint, I can add that too.