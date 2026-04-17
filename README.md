## Molly

WIP

### 环境变量

先基于 `.env.example` 创建本地配置：

```bash
cp .env.example .env.local
```

核心变量：

- `DATABASE_URL`: PostgreSQL 连接串（Drizzle 用于持久化上传会话和文件元数据）
- `S3_*`: MinIO / 其他 S3 兼容对象存储配置

### 数据库初始化

首次初始化建议顺序：

```bash
pnpm db:generate
pnpm db:migrate
```

常用命令：

```bash
pnpm db:push
pnpm db:studio
```

### 开发与验证

```bash
pnpm dev
pnpm lint
pnpm build
```


