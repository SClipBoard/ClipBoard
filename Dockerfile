# 使用 Node.js 18.20.0 作为基础镜像
FROM node:22.18.0-alpine

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 创建必要的目录
RUN mkdir -p uploads logs

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV NODE_ENV=production
ENV DOCKER_ENV=true

# 启动应用
CMD ["pnpm", "start"]
