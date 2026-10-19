import {
  AppstoreOutlined,
  AuditOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HeartOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LayoutOutlined,
  MessageOutlined,
  PhoneOutlined,
  PictureOutlined,
  ProfileOutlined,
  ReadOutlined,
  SettingOutlined,
  ShoppingOutlined,
  StarOutlined,
  ToolOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import type { Component } from 'vue'

/* ==========================================================================
   菜单图标映射
   后端菜单树里 icon 是一个字符串（Component 没法走 JSON），
   这里按名字解析成组件。刻意逐个显式引入，而不是 import * as icons，
   否则会把整套 antd 图标打进产物（几百个组件）。
   ========================================================================== */

const ICONS: Record<string, Component> = {
  AppstoreOutlined,
  AuditOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HeartOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LayoutOutlined,
  MessageOutlined,
  PhoneOutlined,
  PictureOutlined,
  ProfileOutlined,
  ReadOutlined,
  SettingOutlined,
  ShoppingOutlined,
  StarOutlined,
  ToolOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
  UserOutlined
}

/** 按名字取图标组件；找不到时返回 undefined（调用方渲染默认图标） */
export function resolveIcon(name?: string): Component | undefined {
  if (!name) return undefined
  return ICONS[name]
}
