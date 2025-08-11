#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
剪切板同步服务 WebSocket 实时监控脚本
真正的实时监听，不使用轮询

使用方法:
1. 实时监控: python ws_monitor.py
2. 指定设备ID: python ws_monitor.py --device-id my-device
3. 指定服务器: python ws_monitor.py --url ws://localhost:3002/ws

依赖安装: pip install websockets
"""

import asyncio
import json
import sys
import time
from typing import Dict, Any
import websockets
import argparse


class RealtimeClipboardMonitor:
    def __init__(self, url: str = "ws://localhost:3002/ws", device_id: str = "monitor-python"):
        self.base_url = url
        self.device_id = device_id
        self.url = f"{url}?deviceId={device_id}"
        self.websocket = None
        self.running = False
        
    async def connect(self):
        """建立 WebSocket 连接"""
        try:
            print(f"🔗 正在连接到: {self.url}")
            self.websocket = await websockets.connect(self.url)
            self.running = True
            print("✅ WebSocket 连接成功建立")
            print("📡 开始实时监听剪切板变化...")
            print("=" * 60)
            return True
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            return False
    
    async def disconnect(self):
        """断开 WebSocket 连接"""
        if self.websocket:
            self.running = False
            await self.websocket.close()
            print("🔌 WebSocket 连接已断开")
    
    async def send_message(self, message: Dict[str, Any]):
        """发送消息到服务器"""
        if not self.websocket:
            return
        
        try:
            message_str = json.dumps(message, ensure_ascii=False)
            await self.websocket.send(message_str)
            print(f"📤 发送: {message_str}")
        except Exception as e:
            print(f"❌ 发送失败: {e}")
    
    async def listen_messages(self):
        """监听服务器消息"""
        if not self.websocket:
            return
        
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await self.handle_message(data)
                except json.JSONDecodeError as e:
                    print(f"❌ 解析消息失败: {e}")
        except websockets.exceptions.ConnectionClosed:
            print("🔌 连接已关闭")
            self.running = False
        except Exception as e:
            print(f"❌ 监听出错: {e}")
            self.running = False
    
    async def handle_message(self, data: Dict[str, Any]):
        """处理收到的消息"""
        message_type = data.get('type', 'unknown')
        timestamp = time.strftime('%H:%M:%S')
        
        if message_type == 'sync':
            if isinstance(data.get('data'), dict):
                if 'error' in data['data']:
                    print(f"[{timestamp}] ❌ 错误: {data['data']['error']}")
                elif 'message' in data['data']:
                    print(f"[{timestamp}] ✅ {data['data']['message']}")
                else:
                    # 新的剪切板内容推送
                    item = data['data']
                    if item.get('type'):
                        content_preview = item.get('content', '')[:100].replace('\n', ' ')
                        print(f"[{timestamp}] 🆕 新内容: {item.get('type')} - {content_preview}...")
        
        elif message_type == 'delete':
            item_id = data.get('id', 'unknown')
            print(f"[{timestamp}] 🗑️ 内容已删除: {item_id}")
        
        elif message_type == 'all_content':
            items = data.get('data', [])
            count = data.get('count', len(items))
            print(f"[{timestamp}] 📋 当前内容总数: {count} 条")
            
            if items:
                print("最新的3条内容:")
                for i, item in enumerate(items[:3]):
                    created_time = item.get('createdAt', '')[:19].replace('T', ' ')
                    content_preview = item.get('content', '')[:80].replace('\n', ' ')
                    print(f"  {i+1}. [{created_time}] {item.get('type')}: {content_preview}...")
        
        elif message_type == 'connection_stats':
            stats = data.get('data', {})
            print(f"[{timestamp}] 📊 连接统计: {stats.get('activeConnections', 0)} 个活跃连接")
        
        else:
            print(f"[{timestamp}] 📨 收到消息: {message_type}")
    
    async def request_current_content(self):
        """请求当前所有内容"""
        await self.send_message({
            "type": "get_all_content",
            "data": {"limit": 10}
        })
    
    async def start_monitoring(self):
        """开始实时监控"""
        print("🎯 启动实时剪切板监控")
        print("💡 当有新的剪切板内容时，会自动显示")
        print("🔄 获取当前内容...")
        
        # 获取当前内容
        await self.request_current_content()
        
        print("\n⌨️  可用命令:")
        print("  r - 刷新当前内容")
        print("  q - 退出监控")
        print("=" * 60)
        
        # 启动消息监听任务
        listen_task = asyncio.create_task(self.listen_messages())
        
        try:
            # 处理用户输入
            while self.running:
                try:
                    # 非阻塞输入检查
                    await asyncio.sleep(0.1)
                    
                    # 这里可以添加键盘输入处理
                    # 为了简化，我们只是保持连接
                    
                except KeyboardInterrupt:
                    break
                    
        except KeyboardInterrupt:
            print("\n⏹️ 用户中断监控")
        finally:
            listen_task.cancel()
            await self.disconnect()


async def main():
    parser = argparse.ArgumentParser(description="剪切板同步服务 WebSocket 实时监控")
    parser.add_argument("--url", default="ws://localhost:3002/ws", help="WebSocket服务器地址")
    parser.add_argument("--device-id", default="monitor-python", help="设备ID")
    
    args = parser.parse_args()
    
    monitor = RealtimeClipboardMonitor(args.url, args.device_id)
    
    # 建立连接
    if not await monitor.connect():
        return
    
    try:
        await monitor.start_monitoring()
    except KeyboardInterrupt:
        print("\n👋 监控已退出")
    except Exception as e:
        print(f"❌ 程序异常: {e}")


if __name__ == "__main__":
    print("🚀 剪切板同步服务 - 实时监控工具")
    print("=" * 50)
    print("💡 这是真正的实时监控，不使用轮询")
    print("📡 服务器会主动推送剪切板变化")
    print("=" * 50)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 程序已退出")
    except Exception as e:
        print(f"❌ 程序异常: {e}")
        sys.exit(1)
