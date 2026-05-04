/**
 * RBAC seed data for Phase 1 (T1.4).
 *
 * 在系统首次启动时初始化：
 *   1) 14 条基础权限 (permissions)
 *   2) 3 个基础角色 (roles)
 *   3) 角色-权限绑定 (role_permissions)
 *   4) 超管账号 (users) —— 从 .env 的 ADMIN_EMAIL/ADMIN_PASSWORD 迁移
 *   5) 超管角色绑定 (user_roles)
 *   6) 默认菜单树 (menus)
 *
 * 全部使用 INSERT OR IGNORE / 存在性判断，幂等可重复跑。
 * 详见 docs/04-admin-architecture.md §7.3 / §7.5。
 */

const bcrypt = require("bcryptjs");
const { nowIso } = require("../utils");

// ============================================================
// 1) 权限 —— 14 条
// ============================================================
const PERMISSIONS = [
  { code: "post:list",      resource: "post",      action: "list",      name: "查看文章列表",   description: "浏览文章列表与详情" },
  { code: "post:create",    resource: "post",      action: "create",    name: "创建文章",       description: "新建草稿与文章" },
  { code: "post:update",    resource: "post",      action: "update",    name: "编辑文章",       description: "修改已有文章内容" },
  { code: "post:delete",    resource: "post",      action: "delete",    name: "删除文章",       description: "永久删除文章" },
  { code: "post:publish",   resource: "post",      action: "publish",   name: "发布/下架文章",  description: "切换文章发布状态" },
  { code: "tag:list",       resource: "tag",       action: "list",      name: "查看标签",       description: "浏览标签列表" },
  { code: "tag:create",     resource: "tag",       action: "create",    name: "创建标签",       description: "新增博客标签" },
  { code: "tag:update",     resource: "tag",       action: "update",    name: "编辑标签",       description: "修改标签名称/slug" },
  { code: "tag:delete",     resource: "tag",       action: "delete",    name: "删除标签",       description: "删除标签（自动解除文章关联）" },
  { code: "category:list",   resource: "category", action: "list",      name: "查看分类",       description: "浏览分类列表" },
  { code: "category:create", resource: "category", action: "create",    name: "创建分类",       description: "新增博客分类" },
  { code: "category:update", resource: "category", action: "update",    name: "编辑分类",       description: "修改分类名称/slug" },
  { code: "category:delete", resource: "category", action: "delete",    name: "删除分类",       description: "删除分类（自动解除文章关联）" },
  { code: "user:list",      resource: "user",      action: "list",      name: "查看用户",       description: "浏览后台用户列表" },
  { code: "user:create",    resource: "user",      action: "create",    name: "创建用户",       description: "新增后台用户" },
  { code: "user:update",    resource: "user",      action: "update",    name: "更新用户",       description: "修改后台用户资料 / 状态" },
  { code: "user:delete",    resource: "user",      action: "delete",    name: "删除用户",       description: "永久删除后台用户" },
  { code: "role:assign",    resource: "role",      action: "assign",    name: "分配角色",       description: "管理角色及其权限" },
  { code: "analytics:view", resource: "analytics", action: "view",      name: "查看数据统计",   description: "访问数据分析仪表盘" },
  { code: "ops:backup",     resource: "ops",       action: "backup",    name: "执行备份",       description: "触发数据库备份任务" },
  { code: "ops:logs",       resource: "ops",       action: "logs",      name: "查看审计日志",   description: "浏览操作审计日志" },
  { code: "menu:manage",    resource: "menu",      action: "manage",    name: "管理后台菜单",   description: "维护后台侧边栏菜单" },
];

// ============================================================
// 2) 角色 + 权限绑定
// ============================================================
const ROLES = [
  {
    code: "super_admin",
    name: "超级管理员",
    description: "拥有全部权限（实际靠 users.is_super_admin=1 跳过 RBAC，此处绑定关系仅为可读审计）",
    permissions: "*", // 全部
  },
  {
    code: "content_admin",
    name: "内容管理员",
    description: "可管理博客内容（文章 / 标签 / 分类 / 友链）",
    permissions: ["post:list", "post:create", "post:update", "post:delete", "post:publish", "tag:list", "tag:create", "tag:update", "tag:delete", "category:list", "category:create", "category:update", "category:delete", "analytics:view"],
  },
  {
    code: "viewer",
    name: "访客/只读",
    description: "只能浏览数据，不能修改",
    permissions: ["post:list", "user:list", "analytics:view", "ops:logs"],
  },
];

// ============================================================
// 3) 默认菜单树
// 命名约定：parent 为 null 即顶级；children 数组为子项
// permission_code 表示访问该菜单需要的权限（super_admin 自动放行）
// ============================================================
const MENUS = [
  { name: "仪表盘",   path: "/cms/dashboard", icon: "DashboardOutline",     permission: null,             sort: 1 },
  {
    name: "博客管理", path: null,             icon: "DocumentTextOutline",  permission: "post:list",      sort: 2,
    children: [
      { name: "文章",   path: "/cms/posts",      icon: "DocumentOutline",   permission: "post:list" },
      { name: "标签",   path: "/cms/tags",       icon: "PricetagOutline",   permission: "post:list" },
      { name: "分类",   path: "/cms/categories", icon: "FolderOutline",     permission: "post:list" },
      { name: "友链",   path: "/cms/links",      icon: "LinkOutline",       permission: "post:list" },
      { name: "媒体库", path: "/cms/media",      icon: "ImageOutline",      permission: "post:list" },
    ],
  },
  {
    name: "权限管理", path: null, icon: "ShieldCheckmarkOutline", permission: "user:list", sort: 3,
    children: [
      { name: "用户", path: "/cms/rbac/users",       icon: "PersonOutline",        permission: "user:list" },
      { name: "角色", path: "/cms/rbac/roles",       icon: "PeopleOutline",        permission: "role:assign" },
      { name: "权限", path: "/cms/rbac/permissions", icon: "KeyOutline",           permission: "role:assign" },
      { name: "菜单", path: "/cms/rbac/menus",       icon: "MenuOutline",          permission: "menu:manage" },
    ],
  },
  { name: "数据分析", path: "/cms/analytics", icon: "BarChartOutline",      permission: "analytics:view", sort: 4 },
  {
    name: "运维",     path: null,             icon: "SettingsOutline",      permission: "ops:logs",       sort: 5,
    children: [
      { name: "审计日志", path: "/cms/ops/logs",    icon: "ReceiptOutline",  permission: "ops:logs" },
      { name: "备份",     path: "/cms/ops/backup",  icon: "ArchiveOutline",  permission: "ops:backup" },
      { name: "系统监控", path: "/cms/ops/monitor", icon: "PulseOutline",    permission: "ops:logs" },
    ],
  },
];

// ============================================================
// 主入口
// ============================================================
function ensureRbacSeed(db, { adminEmail, adminPassword, adminPasswordHash }) {
  const now = nowIso();

  const tx = db.transaction(() => {
    seedPermissions(db, now);
    seedRoles(db, now);
    seedRolePermissions(db);
    seedSuperAdmin(db, { adminEmail, adminPassword, adminPasswordHash, now });
    seedMenus(db, now);
  });

  tx();
}

// ----- permissions -----
function seedPermissions(db, now) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO permissions (name, code, resource, action, description, created_at)
    VALUES (@name, @code, @resource, @action, @description, @created_at)
  `);
  for (const p of PERMISSIONS) {
    stmt.run({ ...p, created_at: now });
  }
}

// ----- roles -----
function seedRoles(db, now) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO roles (name, code, description, status, created_at, updated_at)
    VALUES (@name, @code, @description, 'active', @created_at, @updated_at)
  `);
  for (const r of ROLES) {
    stmt.run({ name: r.name, code: r.code, description: r.description, created_at: now, updated_at: now });
  }
}

// ----- role_permissions -----
function seedRolePermissions(db) {
  const getRoleId = db.prepare(`SELECT id FROM roles WHERE code = ?`);
  const getAllPermIds = db.prepare(`SELECT id FROM permissions`);
  const getPermIdByCode = db.prepare(`SELECT id FROM permissions WHERE code = ?`);
  const insertRP = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);

  for (const role of ROLES) {
    const roleRow = getRoleId.get(role.code);
    if (!roleRow) continue;

    let permIds;
    if (role.permissions === "*") {
      permIds = getAllPermIds.all().map((row) => row.id);
    } else {
      permIds = role.permissions
        .map((code) => getPermIdByCode.get(code))
        .filter(Boolean)
        .map((row) => row.id);
    }
    for (const pid of permIds) {
      insertRP.run(roleRow.id, pid);
    }
  }
}

// ----- super admin user -----
function seedSuperAdmin(db, { adminEmail, adminPassword, adminPasswordHash, now }) {
  const username = (adminEmail || "admin").split("@")[0] || "admin";
  const existing = db
    .prepare(`SELECT id FROM users WHERE email = ? OR username = ?`)
    .get(adminEmail, username);

  // 优先用 hash；否则现场 bcrypt（cost 10）
  const passwordHash = adminPasswordHash && adminPasswordHash.trim().length > 0
    ? adminPasswordHash
    : bcrypt.hashSync(String(adminPassword || "admin"), 10);

  let userId;
  if (existing) {
    userId = existing.id;
    // 已存在则不覆盖密码；只确保是超管
    db.prepare(`UPDATE users SET is_super_admin = 1, status = 'active', updated_at = ? WHERE id = ?`)
      .run(now, userId);
  } else {
    const info = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, status, is_super_admin, created_at, updated_at)
      VALUES (@username, @email, @password_hash, @display_name, 'active', 1, @created_at, @updated_at)
    `).run({
      username,
      email: adminEmail,
      password_hash: passwordHash,
      display_name: "超级管理员",
      created_at: now,
      updated_at: now,
    });
    userId = info.lastInsertRowid;
  }

  // 绑定 super_admin 角色
  const role = db.prepare(`SELECT id FROM roles WHERE code = 'super_admin'`).get();
  if (role) {
    db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`)
      .run(userId, role.id);
  }
}

// ----- menus -----
// 策略：menus 表为空时才整树写入；非空说明用户已经在后台改过菜单，不动
function seedMenus(db, now) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM menus`).get().c;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO menus (parent_id, name, path, icon, permission_code, sort_order, status, created_at)
    VALUES (@parent_id, @name, @path, @icon, @permission_code, @sort_order, 'active', @created_at)
  `);

  let order = 0;
  for (const top of MENUS) {
    order += 1;
    const parentInfo = insert.run({
      parent_id: null,
      name: top.name,
      path: top.path,
      icon: top.icon,
      permission_code: top.permission || null,
      sort_order: top.sort != null ? top.sort : order,
      created_at: now,
    });
    const parentId = parentInfo.lastInsertRowid;

    if (Array.isArray(top.children)) {
      let childOrder = 0;
      for (const c of top.children) {
        childOrder += 1;
        insert.run({
          parent_id: parentId,
          name: c.name,
          path: c.path,
          icon: c.icon,
          permission_code: c.permission || null,
          sort_order: childOrder,
          created_at: now,
        });
      }
    }
  }
}

module.exports = {
  ensureRbacSeed,
  // 单测时方便 import 内部常量
  _PERMISSIONS: PERMISSIONS,
  _ROLES: ROLES,
  _MENUS: MENUS,
};
