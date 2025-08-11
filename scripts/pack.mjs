import { execSync } from 'node:child_process'
import { promises as fs, createWriteStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const pipelineAsync = promisify(pipeline)
const nodeVersion = '22.17.0'

// 获取命令行参数
const args = process.argv.slice(2)
const buildTarget = args.find(arg => arg.startsWith('--target='))?.split('=')[1]

function run(cmd, cwd) {
  execSync(cmd, { stdio: 'inherit', cwd })
}

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}

async function downloadNodejs(platform) {
  const nodeUrls = {
    linux: `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.xz`,
    windows: `https://nodejs.org/download/release/latest-v22.x/win-x64/node.exe`
  }
  
  const url = nodeUrls[platform]
  if (!url) {
    throw new Error(`不支持的平台: ${platform}`)
  }
  
  const fileName = url.split('/').pop()
  const filePath = path.join(root, fileName)
  
  console.log(`📥 正在下载 Node.js ${nodeVersion} for ${platform}...`)
  
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filePath)
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: ${response.statusCode}`))
        return
      }
      
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        console.log(`✅ Node.js 下载完成: ${fileName}`)
        resolve(filePath)
      })
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}) // 删除不完整的文件
      reject(err)
    })
  })
}

// 解压和部署Node.js
async function deployNodejs(platform, downloadedFile, packageDir) {
  if (platform === 'linux') {
    console.log('📦 正在解压 Linux Node.js...')
    // 解压到临时目录
    execSync(`tar -xf "${downloadedFile}"`, { cwd: root })
    
    // 重命名为node文件夹
    const extractedDir = path.join(root, `node-v${nodeVersion}-linux-x64`)
    const targetDir = path.join(packageDir, 'node')
    
    if (await exists(extractedDir)) {
      await fs.rename(extractedDir, targetDir)
      console.log('✅ Linux Node.js 部署到 package/node')
    } else {
      throw new Error('Linux Node.js 解压失败')
    }
  } else if (platform === 'windows') {
    console.log('📦 正在部署 Windows Node.js...')
    // 直接复制node.exe到package目录
    const targetFile = path.join(packageDir, 'node.exe')
    
    await fs.copyFile(downloadedFile, targetFile)
    console.log('✅ Windows Node.js 部署到 package/node.exe')
  }
  
  // 清理下载的文件
  await fs.unlink(downloadedFile)
}

async function createStartupScripts(packageDir, platform) {
  console.log('📝 创建启动脚本...')
  
  if (platform === 'windows') {
    // Windows启动脚本
    const startBat = `@echo off
chcp 65001 >nul
echo 正在启动共享剪切板服务...
echo.
echo 服务将在 http://localhost:3001 启动
echo 按 Ctrl+C 停止服务
echo.
.\\node.exe api\\server.js
pause`
    
    await fs.writeFile(path.join(packageDir, 'start.bat'), startBat, 'utf8')
  } else if (platform === 'linux') {
    // Linux启动脚本
    const startSh = `#!/bin/bash
echo "正在启动共享剪切板服务..."
echo ""
echo "服务将在 http://localhost:3001 启动"
echo "按 Ctrl+C 停止服务"
echo ""
./node/bin/node api/server.js`
    
    await fs.writeFile(path.join(packageDir, 'start.sh'), startSh)
    
    // 设置执行权限
    try {
      execSync(`chmod +x "${path.join(packageDir, 'start.sh')}"`)
    } catch (e) {
      console.log('⚠️  无法设置执行权限，请在Linux系统中手动设置')
    }
  } else {
    // 通用启动脚本（需要系统已安装Node.js）
    const startBat = `@echo off
chcp 65001 >nul
echo 正在启动共享剪切板服务...
echo.
echo 服务将在 http://localhost:3001 启动
echo 按 Ctrl+C 停止服务
echo.
node api\\server.js
pause`
    
    const startSh = `#!/bin/bash
echo "正在启动共享剪切板服务..."
echo ""
echo "服务将在 http://localhost:3001 启动"
echo "按 Ctrl+C 停止服务"
echo ""
node api/server.js`
    
    await fs.writeFile(path.join(packageDir, 'start.bat'), startBat, 'utf8')
    await fs.writeFile(path.join(packageDir, 'start.sh'), startSh)
    
    // 设置执行权限
    try {
      execSync(`chmod +x "${path.join(packageDir, 'start.sh')}"`)
    } catch (e) {
      console.log('⚠️  无法设置执行权限，请在Linux系统中手动设置')
    }
  }
}

async function createReadme(packageDir, name, version, platform) {
  console.log('📋 创建说明文件...')
  
  const readme = `# ${name}

## 安装说明

1. ${platform ? `本包已内置 Node.js ${nodeVersion}，无需单独安装` : '确保已安装 Node.js (版本 >= 18)'}
2. 解压缩包到目标目录
3. (可选) 配置环境变量:
   - 复制 .env.example 为 .env 并修改配置
4. 运行启动脚本:
   - Windows: 双击 start.bat
   - Linux/Mac: 运行 ./start.sh

## 默认访问地址

http://localhost:3001

## 端口配置

- 修改 .env 文件中的 PORT 可以更改服务端口
- 修改后需要重启服务才能生效
- 确保防火墙允许新端口访问

## 功能特性

- 跨设备剪切板同步
- 支持文本和文件传输
- 实时WebSocket连接
- 设备管理和配置
- 搜索和过滤功能

## 注意事项

- ${platform ? `本包已内置 Node.js ${nodeVersion} 和所有依赖` : 'Node.js依赖已预装'}
- 首次运行会自动创建数据库表
- 确保防火墙允许相关端口访问
- 建议在生产环境中使用 PM2 等进程管理工具

版本: ${version}
构建时间: ${new Date().toLocaleString('zh-CN')}
${platform ? `目标平台: ${platform}` : '通用版本'}`
  
  await fs.writeFile(path.join(packageDir, 'README.md'), readme)
}

async function main() {
  try {
    console.log(`🚀 开始创建生产包${buildTarget ? ` (目标平台: ${buildTarget})` : ''}...`)
    
    // 1) 读取 package.json 基本信息
    const pkgPath = path.join(root, 'package.json')
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
    const name = pkg.name || 'clipboard-sync'
    const version = pkg.version || '0.0.0'
    const deps = pkg.dependencies || {}

    // 2) 自动执行构建
    console.log('🔨 正在执行构建...')
    run('npm run build', root)
    
    const distDir = path.join(root, 'dist')
    if (!(await exists(distDir))) {
      throw new Error('构建后仍未找到 dist 目录，请检查构建配置')
    }

    // 3) 创建打包目录
    const packageDir = path.join(distDir, 'package')
    await fs.rm(packageDir, { recursive: true, force: true })
    await fs.mkdir(packageDir, { recursive: true })

    // 4) 复制前端构建文件
    console.log('🎨 复制前端文件...')
    // 前端文件直接在dist根目录下（index.html, assets等）
    const indexPath = path.join(distDir, 'index.html')
    if (await exists(indexPath)) {
      // 复制前端文件到package根目录，排除api目录和其他非前端文件
      const items = await fs.readdir(distDir, { withFileTypes: true })
      for (const item of items) {
        if (item.name === 'api' || item.name === 'package' || item.name.startsWith('.')) {
          continue // 跳过后端文件和隐藏文件
        }
        const srcPath = path.join(distDir, item.name)
        const destPath = path.join(packageDir, item.name)
        if (item.isDirectory()) {
          await fs.cp(srcPath, destPath, { recursive: true })
        } else {
          await fs.copyFile(srcPath, destPath)
        }
      }
      console.log('✅ 前端文件复制完成')
    } else {
      console.log('⚠️  未找到前端构建文件，请确保已执行 npm run build:frontend')
    }

    // 5) 复制后端构建文件
    console.log('📦 复制服务端文件...')
    const apiDistDir = path.join(distDir, 'api')
    if (await exists(apiDistDir)) {
      await fs.cp(apiDistDir, path.join(packageDir, 'api'), { recursive: true })
    }

    // 6) 在 package 目录写入运行时 package.json（仅保留生产依赖）
    const runtimePkg = {
      name,
      version,
      private: true,
      type: 'module',
      scripts: {
        start: 'node api/server.js'
      },
      dependencies: deps
    }
    await fs.writeFile(path.join(packageDir, 'package.json'), JSON.stringify(runtimePkg, null, 2))

    // 6) 跳过配置文件复制（根据要求不复制配置文件）
    console.log('⚠️  跳过配置文件复制（请手动配置生产环境）')

    // 7) 复制数据库迁移文件
    console.log('📋 复制数据库迁移文件...')
    const migrationsDir = path.join(root, 'migrations')
    if (await exists(migrationsDir)) {
      await fs.cp(migrationsDir, path.join(packageDir, 'migrations'), { recursive: true })
    }

    // 8) 创建uploads目录
    console.log('📁 创建uploads目录...')
    await fs.mkdir(path.join(packageDir, 'uploads'), { recursive: true })

    // 9) 下载并部署Node.js
    if (buildTarget) {
      const downloadedFile = await downloadNodejs(buildTarget)
      await deployNodejs(buildTarget, downloadedFile, packageDir)
    } else {
      console.log('ℹ️  未指定目标平台，跳过Node.js下载')
    }

    // 10) 安装生产依赖
    console.log('📦 安装生产依赖...')
    run('npm install --production --no-dev', packageDir)

    // 11) 创建启动脚本
    await createStartupScripts(packageDir, buildTarget)

    // 12) 创建说明文档
    await createReadme(packageDir, name, version, buildTarget)

    console.log('✅ 打包完成!')
    console.log(`📁 输出目录: ${packageDir}`)
    
    // 计算包大小
    const stats = await fs.stat(packageDir)
    console.log(`📦 包大小: ${(await getDirSize(packageDir) / 1024 / 1024).toFixed(2)} MB`)
    
  } catch (error) {
    console.error('❌ 打包失败:', error)
    process.exit(1)
  }
}

// 计算目录大小的辅助函数
async function getDirSize(dirPath) {
  let size = 0
  const items = await fs.readdir(dirPath, { withFileTypes: true })
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item.name)
    if (item.isDirectory()) {
      size += await getDirSize(itemPath)
    } else {
      const stats = await fs.stat(itemPath)
      size += stats.size
    }
  }
  
  return size
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

