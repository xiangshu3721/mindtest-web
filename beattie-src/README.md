# 情绪健康测试

本地静态 SPA（Vite + TypeScript），收录梅洛迪·贝蒂书中 Part 3 六套情绪测试，题目与计分逻辑按简体中文版原文录入。

## 开发 / 构建

```bash
cd beattie-src
npm install
npm run build
```

`npm run build` 输出到仓库根目录的 `beattie/`（`base: './'`）。GitHub Pages 地址：

https://xiangshu3721.github.io/mindtest-web/beattie/

本地在仓库根目录起静态服务器后打开 `/beattie/`。

## 六套测试

| 测试 | 评估 | 选择 | 判断 |
|------|------|------|------|
| 情绪健康测试 | 10 | 5 | 8 |
| 愤怒测试 | 10 | 5 | 8 |
| 恐惧测试 | 10 | 5 | 8 |
| 戏剧化与不幸成瘾测试 | 10 | 5 | 8 |
| 内疚测试 | 10 | 5 | 8 |
| 悲痛与失落测试 | 10 | 5 | 8 |

戏剧化测试开始前会显示悲痛提醒。分数与档案保存在浏览器 localStorage（情绪档案）。

## 版权声明

题目与计分逻辑来源于梅洛迪·贝蒂《如何为爱立界限》（The New Codependency）Part 3，简体中文版由湛庐文化 / 中国纺织出版社发行；本页仅供个人学习与自我觉察的网页测试版，非官方出版物。
