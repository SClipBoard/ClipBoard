/**
 * Swagger API 文档配置
 */
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Application } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * 动态检测API文件路径
 */
function getApiPaths(): string[] {
  const currentDir = process.cwd();
  const apiDir = path.join(currentDir, 'api');

  // 检查是否存在编译后的JS文件
  const appJsPath = path.join(apiDir, 'app.js');
  const appTsPath = path.join(apiDir, 'app.ts');

  // 检查routes目录中的文件类型
  const routesDir = path.join(apiDir, 'routes');
  let hasJsFiles = false;
  let hasTsFiles = false;

  if (fs.existsSync(routesDir)) {
    const files = fs.readdirSync(routesDir);
    hasJsFiles = files.some(file => file.endsWith('.js'));
    hasTsFiles = files.some(file => file.endsWith('.ts'));
  }

  // 优先使用JS文件（生产环境），如果不存在则使用TS文件（开发环境）
  if (fs.existsSync(appJsPath) && hasJsFiles) {
    console.log('🔍 Swagger: 使用编译后的JS文件');
    return [
      './api/routes/*.js',
      './api/app.js'
    ];
  } else if (fs.existsSync(appTsPath) && hasTsFiles) {
    console.log('🔍 Swagger: 使用TypeScript源文件');
    return [
      './api/routes/*.ts',
      './api/app.ts'
    ];
  } else {
    console.warn('⚠️  Swagger: 未找到API文件，使用默认路径');
    return [
      './api/routes/*.ts',
      './api/app.ts'
    ];
  }
}

// Swagger 配置选项
const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '剪切板同步服务 API',
      version: '1.0.0',
      description: '跨设备剪切板同步服务的 REST API 接口文档',
      contact: {
        name: 'API Support',
        email: 'support@clipboard-sync.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'API 服务器'
      }
    ],
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: '请求是否成功'
            },
            message: {
              type: 'string',
              description: '响应消息'
            },
            data: {
              description: '响应数据'
            },
            total: {
              type: 'number',
              description: '总数（分页时使用）'
            }
          },
          required: ['success']
        },
        ClipboardItem: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '唯一标识符'
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'file'],
              description: '内容类型'
            },
            content: {
              type: 'string',
              description: '内容数据'
            },
            deviceId: {
              type: 'string',
              description: '设备ID'
            },
            fileName: {
              type: 'string',
              description: '文件名（文件类型时使用）'
            },
            fileSize: {
              type: 'number',
              description: '文件大小（文件类型时使用）'
            },
            mimeType: {
              type: 'string',
              description: 'MIME类型（文件类型时使用）'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: '更新时间'
            }
          },
          required: ['id', 'type', 'content', 'deviceId', 'createdAt', 'updatedAt']
        },
        UploadRequest: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['text', 'image', 'file'],
              description: '内容类型'
            },
            content: {
              type: 'string',
              description: '内容数据'
            },
            deviceId: {
              type: 'string',
              description: '设备ID'
            },
            fileName: {
              type: 'string',
              description: '文件名（文件类型时必需）'
            },
            fileSize: {
              type: 'number',
              description: '文件大小（文件类型时可选）'
            },
            mimeType: {
              type: 'string',
              description: 'MIME类型（文件类型时可选）'
            }
          },
          required: ['type', 'content', 'deviceId']
        },
        AppConfig: {
          type: 'object',
          properties: {
            maxItems: {
              type: 'number',
              description: '最大条目数'
            },
            autoCleanupDays: {
              type: 'number',
              description: '自动清理天数'
            }
          }
        },
        ConnectionStats: {
          type: 'object',
          properties: {
            totalConnections: {
              type: 'number',
              description: '总连接数'
            },
            activeConnections: {
              type: 'number',
              description: '活跃连接数'
            },
            deviceConnections: {
              type: 'object',
              description: '设备连接统计'
            }
          }
        },
        StorageStats: {
          type: 'object',
          properties: {
            totalItems: {
              type: 'number',
              description: '总条目数'
            },
            textItems: {
              type: 'number',
              description: '文本条目数'
            },
            imageItems: {
              type: 'number',
              description: '图片条目数'
            },
            totalSize: {
              type: 'string',
              description: '总存储大小'
            }
          }
        },
        WebSocketMessage: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['sync', 'delete', 'get_all_text', 'get_all_images', 'get_latest', 'get_all_content', 'all_text', 'all_images', 'latest', 'all_content', 'error', 'pong', 'ping', 'new_item', 'delete_item', 'connection_stats'],
              description: '消息类型'
            },
            data: {
              description: '消息数据，可以是剪切板项、剪切板项数组、连接统计等'
            },
            id: {
              type: 'string',
              description: '项目ID（删除操作时使用）'
            },
            count: {
              type: 'number',
              description: '数量（获取最新内容时使用）'
            },
            message: {
              type: 'string',
              description: '消息说明'
            },
            deviceId: {
              type: 'string',
              description: '设备ID'
            }
          },
          required: ['type']
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: '错误消息'
            }
          },
          required: ['success', 'message']
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: '页码',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: '每页条目数',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        TypeParam: {
          name: 'type',
          in: 'query',
          description: '内容类型筛选',
          required: false,
          schema: {
            type: 'string',
            enum: ['text', 'image', 'file']
          }
        },
        SearchParam: {
          name: 'search',
          in: 'query',
          description: '搜索关键词',
          required: false,
          schema: {
            type: 'string'
          }
        },
        FilterParam: {
          name: 'filter',
          in: 'query',
          description: '特殊筛选',
          required: false,
          schema: {
            type: 'string',
            enum: ['all_text', 'all_images', 'latest']
          }
        },
        DeviceIdParam: {
          name: 'deviceId',
          in: 'query',
          description: '设备ID筛选',
          required: false,
          schema: {
            type: 'string'
          }
        },
        IdParam: {
          name: 'id',
          in: 'path',
          description: '项目ID',
          required: true,
          schema: {
            type: 'string'
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: '健康检查接口'
      },
      {
        name: 'Clipboard',
        description: '剪切板内容管理接口'
      },
      {
        name: 'Devices',
        description: '设备管理接口'
      },
      {
        name: 'Config',
        description: '配置管理接口'
      },
      {
        name: 'WebSocket',
        description: 'WebSocket 实时通信接口'
      }
    ]
  },
  apis: getApiPaths()
};

// 生成 Swagger 规范
const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 * 设置 Swagger 文档
 */
export function setupSwagger(app: Application): void {
  // Swagger UI 配置
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
    customSiteTitle: '剪切板同步服务 API 文档',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true
    }
  };

  // 设置 API 文档路由
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // 提供 JSON 格式的 API 规范
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 API 文档已启用:');
  console.log('   - Swagger UI: /api/docs');
  console.log('   - JSON 规范: /api/docs.json');
}

export { swaggerSpec };
