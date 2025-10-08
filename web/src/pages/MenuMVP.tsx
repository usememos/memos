import { DownloadIcon, PlusIcon, TrashIcon, UploadIcon, FilePlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import memoStore from "@/store/memo";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { toast } from "react-hot-toast";
import MenuOrdersView from "@/components/MenuOrdersView";

type MenuItem = { id: string; name: string; price?: number };
type Menu = { id: string; name: string; items: MenuItem[] };

const STORAGE_KEY = "memos.menu.mvp";

function loadMenus(): Menu[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as Menu[];
  } catch {
    // ignore
  }
  return [];
}

function saveMenus(menus: Menu[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
}

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const MenuMVP = () => {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [newMenuName, setNewMenuName] = useState("");

  // 订单构建状态：itemId -> qty
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCandidates, setImportCandidates] = useState<any[]>([]);

  useEffect(() => {
    const ms = loadMenus();
    setMenus(ms);
    if (ms.length > 0) setSelectedMenuId(ms[0].id);
  }, []);

  const selectedMenu = useMemo(() => menus.find((m) => m.id === selectedMenuId), [menus, selectedMenuId]);

  const addMenu = () => {
    const name = newMenuName.trim();
    if (!name) return;
    const id = slugify(name) || `menu-${Date.now()}`;
    if (menus.some((m) => m.id === id)) {
      toast.error("ID 已存在，请更换名称");
      return;
    }
    const next = [...menus, { id, name, items: [] }];
    setMenus(next);
    saveMenus(next);
    setSelectedMenuId(id);
    setNewMenuName("");
  };

  const deleteMenu = (id: string) => {
    const next = menus.filter((m) => m.id !== id);
    setMenus(next);
    saveMenus(next);
    if (selectedMenuId === id) setSelectedMenuId(next[0]?.id ?? "");
  };

  const addItem = () => {
    if (!selectedMenu) return;
    const newItem: MenuItem = { id: `i-${Date.now()}`, name: "" };
    const next = menus.map((m) => (m.id === selectedMenu.id ? { ...m, items: [...m.items, newItem] } : m));
    setMenus(next);
    saveMenus(next);
  };

  const updateItem = (itemId: string, patch: Partial<MenuItem>) => {
    if (!selectedMenu) return;
    const next = menus.map((m) =>
      m.id === selectedMenu.id
        ? { ...m, items: m.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
        : m,
    );
    setMenus(next);
    saveMenus(next);
  };

  const deleteItem = (itemId: string) => {
    if (!selectedMenu) return;
    const next = menus.map((m) =>
      m.id === selectedMenu.id ? { ...m, items: m.items.filter((it) => it.id !== itemId) } : m,
    );
    setMenus(next);
    saveMenus(next);
  };

  const setQty = (itemId: string, qty: number) => {
    setQtyMap((prev) => ({ ...prev, [itemId]: qty }));
  };

  const generateContent = () => {
    if (!selectedMenu) return "";
    const header = `#order #menu:${selectedMenu.id}`;
    const lines: string[] = [header, "", "- items:"];
    for (const it of selectedMenu.items) {
      const qty = Math.max(0, Number(qtyMap[it.id] || 0));
      if (qty > 0) {
        const pricePart = it.price != null ? ` price:${it.price}` : "";
        lines.push(`  - name:"${it.name}" qty:${qty}${pricePart}`);
      }
    }
    if (note.trim()) {
      lines.push(`- note: ${note.trim()}`);
    }
    return lines.join("\n");
  };

  const submitOrder = async () => {
    if (!selectedMenu) {
      toast.error("请先创建并选择菜单");
      return;
    }
    const content = generateContent();
    if (!/qty:\s*\d+/.test(content)) {
      toast.error("请为至少一项设置数量");
      return;
    }
    try {
      await memoStore.createMemo({
        memo: {
          content,
          visibility: Visibility.PRIVATE,
        },
        memoId: "",
        validateOnly: false,
        requestId: "",
      });
      toast.success("已创建订单备忘录");
      // 重置选项但保留菜单
      setQtyMap({});
      setNote("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.details ?? "创建失败");
    }
  };

  // —— 菜单定义导入/导出（通过 Memo 实现跨设备共享）——
  const exportMenusToMemo = async () => {
    try {
      const payload = {
        version: 1,
        menus,
      };
      const json = JSON.stringify(payload, null, 2);
      const content = `#menu-def\n\n\`\`\`json\n${json}\n\`\`\``;
      await memoStore.createMemo({
        memo: {
          content,
          visibility: Visibility.PRIVATE,
        },
        memoId: "",
        validateOnly: false,
        requestId: "",
      });
      toast.success("已导出为菜单定义备忘录（#menu-def）");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.details ?? "导出失败");
    }
  };

  const stripCodeFence = (src: string) => {
    const m = src.match(/```\s*json\s*([\s\S]*?)```/i);
    if (m) return m[1];
    // fallback：找第一个 { 或 [ 开始的 JSON
    const i = Math.min(
      ...[src.indexOf("{"), src.indexOf("[")].filter((x) => x >= 0),
    );
    if (isFinite(i as number) && (i as number) >= 0) return src.slice(i as number);
    return src;
  };

  const importMenusFromMemos = async () => {
    try {
      // 最多读取 5 页，列出所有含 #menu-def 的候选供选择
      let token: string | undefined = undefined;
      const candidates: any[] = [];
      let loop = 0;
      while (loop < 5) {
        const resp = (await memoStore.fetchMemos({ pageToken: token })) || { memos: [], nextPageToken: "" };
        const { memos, nextPageToken } = resp;
        for (const m of memos || []) {
          const c = m.content || "";
          if (!/#menu-def\b/.test(c)) continue;
          try {
            const raw = stripCodeFence(c);
            const data = JSON.parse(raw);
            candidates.push({ memo: m, data });
          } catch {
            // ignore parse errors
          }
        }
        if (!nextPageToken) break;
        token = nextPageToken;
        loop++;
      }
      if (candidates.length === 0) {
        toast.error("未找到 #menu-def 菜单定义备忘录");
        return;
      }
      setImportCandidates(candidates);
      setIsImportOpen(true);
    } catch (err: any) {
      console.error(err);
      toast.error("导入失败");
    }
  };

  const applyImportData = (payload: any) => {
    const importedMenus: Menu[] = Array.isArray(payload?.menus)
      ? payload.menus
      : Array.isArray(payload) ? payload : [];
    if (importedMenus.length === 0) {
      toast.error("菜单定义内容为空或格式不正确");
      return;
    }
    const existingIds = new Set(menus.map((m) => m.id));
    const merged: Menu[] = [...menus];
    for (const im of importedMenus) {
      let id = im.id || slugify(im.name || "menu");
      while (existingIds.has(id)) id = `${id}-imported`;
      existingIds.add(id);
      merged.push({
        id,
        name: im.name || id,
        items: (im.items || []).map((it: any) => ({ id: it.id || slugify(it.name || "item"), name: it.name || "", price: it.price }))
      });
    }
    setMenus(merged);
    saveMenus(merged);
    setIsImportOpen(false);
    toast.success(`已导入 ${importedMenus.length} 个菜单`);
  };

  const bulkAddItems = () => {
    if (!selectedMenu) return;
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const newItems: MenuItem[] = [];
    for (const line of lines) {
      const m = line.match(/^([^,]+?)(?:\s*,\s*(\d+(?:\.\d+)?))?$/);
      if (!m) continue;
      const name = m[1].trim();
      const price = m[2] ? Number(m[2]) : undefined;
      newItems.push({ id: `i-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, price });
    }
    const next = menus.map((m) => (m.id === selectedMenu.id ? { ...m, items: [...m.items, ...newItems] } : m));
    setMenus(next);
    saveMenus(next);
    setShowBulk(false);
    setBulkText("");
    toast.success(`已添加 ${newItems.length} 条目`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-4">
      <h2 className="text-lg font-semibold">菜单（MVP）</h2>

      <div className="grid md:grid-cols-3 gap-4">
        {/* 菜单列表 */}
        <div className="border rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Input placeholder="新菜单名称" value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)} />
            <Button onClick={addMenu}>
              <PlusIcon className="w-4 h-4 mr-1" /> 新建
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {menus.map((m) => (
              <div key={m.id} className={`flex items-center justify-between px-2 py-1 rounded ${m.id === selectedMenuId ? "bg-accent" : ""}`}>
                <button className="text-left grow" onClick={() => setSelectedMenuId(m.id)}>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">ID: {m.id}</div>
                </button>
                <Button variant="ghost" onClick={() => deleteMenu(m.id)}>
                  <TrashIcon className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {menus.length === 0 && <div className="text-sm text-muted-foreground">暂无菜单，请新建</div>}
          </div>
        </div>

        {/* 菜单明细编辑 */}
        <div className="border rounded-xl p-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">{selectedMenu ? `编辑菜单：${selectedMenu.name}` : "请选择菜单"}</div>
            {selectedMenu && (
              <Button variant="outline" onClick={addItem}>
                <PlusIcon className="w-4 h-4 mr-1" /> 添加条目
              </Button>
            )}
          </div>
          {selectedMenu && (
            <div className="mt-3 space-y-2">
              {selectedMenu.items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Label className="text-xs">名称</Label>
                    <Input value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">价格(可选)</Label>
                    <Input
                      type="number"
                      value={it.price ?? ""}
                      onChange={(e) => updateItem(it.id, { price: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">下单数量</Label>
                    <Input
                      type="number"
                      min={0}
                      value={qtyMap[it.id] ?? 0}
                      onChange={(e) => setQty(it.id, Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    <Button variant="ghost" onClick={() => deleteItem(it.id)}>
                      <TrashIcon className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {selectedMenu.items.length === 0 && <div className="text-sm text-muted-foreground">请添加条目</div>}
              <div className="mt-2">
                <Label className="text-xs">备注</Label>
                <Input placeholder="如：少辣、走葱" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={submitOrder}>生成订单备忘录</Button>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(generateContent())}>复制内容预览</Button>
                <div className="grow" />
                <Button variant="outline" onClick={importMenusFromMemos}>
                  <UploadIcon className="w-4 h-4 mr-1" /> 从备忘录导入菜单定义
                </Button>
                <Button variant="outline" onClick={exportMenusToMemo}>
                  <DownloadIcon className="w-4 h-4 mr-1" /> 导出菜单定义到备忘录
                </Button>
                <Button variant="outline" onClick={() => setShowBulk((v) => !v)}>
                  <FilePlusIcon className="w-4 h-4 mr-1" /> 批量添加条目
                </Button>
              </div>
              {showBulk && (
                <div className="mt-2 border rounded-lg p-2">
                  <div className="text-sm text-muted-foreground mb-1">每行格式：名称[,价格]，示例：拿铁,28</div>
                  <textarea className="w-full h-28 rounded-md border bg-background p-2" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
                  <div className="mt-2 flex items-center gap-2">
                    <Button onClick={bulkAddItems}>添加</Button>
                    <Button variant="ghost" onClick={() => setShowBulk(false)}>取消</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择要导入的菜单定义</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {importCandidates.map((c, idx) => (
              <div key={idx} className="border rounded-lg p-2">
                <div className="text-sm">时间：{c.memo.createTime ? new Date(c.memo.createTime).toLocaleString() : ""}</div>
                <div className="text-sm">预览：{Array.isArray(c.data?.menus) ? c.data.menus.map((m: any) => m.name).filter(Boolean).slice(0,3).join("，") : "(未知格式)"}</div>
                <div className="mt-2">
                  <Button onClick={() => applyImportData(c.data)}>导入此定义</Button>
                </div>
              </div>
            ))}
            {importCandidates.length === 0 && <div className="text-sm text-muted-foreground">暂无候选</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsImportOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MenuOrdersView selectedMenuId={selectedMenu?.id} />
    </div>
  );
};

export default MenuMVP;
