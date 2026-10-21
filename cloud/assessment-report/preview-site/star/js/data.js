/** 图上四栏里的词，不含末尾省略号。共 31 个。 */
export const GROUPS = [
  [
    "人际/归属感",
    "团队合作",
    "能帮助他人",
    "家庭",
    "朋友",
    "亲密关系",
    "有益于社会",
  ],
  [
    "稳定",
    "安全",
    "健康",
    "乐趣",
    "物质保障",
    "工作与生活平衡",
    "符合我的道德观",
  ],
  [
    "高收入",
    "被认可",
    "受尊重",
    "成就感",
    "成功",
    "名誉",
    "地位",
    "竞争",
    "权力",
  ],
  [
    "创造性",
    "新鲜感",
    "自由",
    "挑战性",
    "冒险性",
    "多样性和变化性",
    "能发挥自己的才能",
    "有学习/成长的机会",
  ],
];

export const WORDS = GROUPS.flat();

/** 31 个词：划掉 15，再划掉 10，再划掉 3，最后剩 3。 */
export const CULL_FIRST = 15;
export const CULL_SECOND = 10;
export const CULL_THIRD = 3;
export const KEEP = 3;
export const REVIVE = 3;
