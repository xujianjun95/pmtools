// 基金公司直销渠道映射：从基金名前缀识别管理人，返回其官网。
// 直销 = 基金公司自有平台（官网/APP），QDII 限购时直销额度通常高于代销。
// 官网以各公司防诈公告披露的法定网址为准（2026-09 逐家核验）。
// detail 为基金产品详情页模板（{code} 占位符），仅收录实测可达（HTTP 200）的格式；
// 未提供 detail 的公司点击后落到官网首页。
const COMPANIES = [
  // 长关键词放前面，避免前缀误配（如"东方红"先于"东"字类）
  ['东方红', '东方红资产管理', 'https://www.dfham.com'],
  ['交银', '交银施罗德基金', 'https://www.fund001.com'],
  ['光大', '光大保德信基金', 'https://www.epf.com.cn'],
  ['创金合信', '创金合信基金', 'https://www.cjhxfund.com'],
  ['华泰柏瑞', '华泰柏瑞基金', 'https://www.huatai-pb.com', 'https://www.huatai-pb.com/products/zhishu/{code}/index.html'],
  ['工银', '工银瑞信基金', 'https://www.icbccs.com.cn'],
  ['浦银', '浦银安盛基金', 'https://www.py-axa.com'],
  ['申万菱信', '申万菱信基金', 'https://www.swsmu.com'],
  ['国投瑞银', '国投瑞银基金', 'https://www.ubssdic.com'],
  ['国富', '国海富兰克林基金', 'https://www.ftsfund.com'],
  ['汇丰晋信', '汇丰晋信基金', 'https://www.hsbcjt.cn'],
  ['汇添富', '汇添富基金', 'https://www.99fund.com', 'https://www.99fund.com/main/products/pofund/{code}/fundinfo.shtml'],
  ['摩根', '摩根资产管理', 'https://www.cifm.com', 'https://www.cifm.com/fund/{code}'],
  ['景顺长城', '景顺长城基金', 'https://www.invescogreatwall.com'],
  ['宏利', '宏利基金', 'https://www.manulifefund.com.cn'],
  ['海富通', '海富通基金', 'https://www.hftfund.com'],
  ['华夏', '华夏基金', 'https://www.chinaamc.com', 'https://www.chinaamc.com/fund/{code}/'],
  ['华安', '华安基金', 'https://www.huaan.com.cn', 'https://www.huaan.com.cn/funds/{code}/'],
  ['华宝', '华宝基金', 'https://www.fsfund.com'],
  ['嘉实', '嘉实基金', 'https://www.jsfund.cn', 'https://www.jsfund.cn/main/fund/{code}/fundManager.shtml'],
  ['博时', '博时基金', 'https://www.bosera.com', 'https://www.bosera.com/fund/{code}.html'],
  ['广发', '广发基金', 'https://www.gffunds.com.cn', 'https://www.gffunds.com.cn/funds?fundcode={code}'],
  ['建信', '建信基金', 'https://www.ccbfund.cn'],
  ['招商', '招商基金', 'https://www.cmfchina.com', 'https://www.cmfchina.com/web/fundDetail/{code}/'],
  ['大成', '大成基金', 'https://www.dcfund.com.cn', 'https://www.dcfund.com.cn/main/fund/productdetail/index.shtml?product_code={code}'],
  ['天弘', '天弘基金', 'https://www.thfund.com.cn', 'http://yuebao.thfund.com.cn/fundinfo/{code}'],
  ['南方', '南方基金', 'https://www.nffund.com', 'https://www.nffund.com/main/nffund/personal-financing/detail.shtml?fundCode={code}'],
  ['国泰', '国泰基金', 'https://www.gtfund.com', 'https://www.gtfund.com/product/productlist/haiwai/{code}/summary/index.html'],
  ['万家', '万家基金', 'https://www.wjasset.com', 'https://www.wjasset.com/products/qdii/{code}/'],
  ['宝盈', '宝盈基金', 'http://www.byfunds.com', 'http://www.byfunds.com/fundDetail/{code}/index.html'],
  ['富国', '富国基金', 'https://www.fullgoal.com.cn'],
  ['平安', '平安基金', 'https://fund.pingan.com'],
  ['鹏华', '鹏华基金', 'https://www.phfund.com.cn'],
  ['长城', '长城基金', 'https://www.ccfund.com.cn'],
  ['长盛', '长盛基金', 'https://www.csfunds.com.cn'],
  ['中欧', '中欧基金', 'https://www.zofund.com'],
  ['融通', '融通基金', 'https://www.rtfund.com'],
  ['诺安', '诺安基金', 'https://www.lionfund.com.cn'],
  ['银华', '银华基金', 'https://www.yhfund.com.cn'],
  ['易方达', '易方达基金', 'https://www.efunds.com.cn', 'https://www.efunds.com.cn/Mobile/fund/{code}.shtml'],
]

/**
 * 按基金名前缀识别管理人。
 * @param {string} name  基金名称
 * @param {string} [code] 基金代码（6 位）。提供且公司有详情页模板时，
 *                        返回 detailUrl 指向官网产品详情页；否则回退官网首页。
 * @returns {{ company: string, url: string, detailUrl?: string } | null}
 */
export function getDirectChannel(name, code) {
  if (!name) return null
  for (const [keyword, company, url, detail] of COMPANIES) {
    if (name.startsWith(keyword)) {
      const result = { company, url }
      if (detail && code) result.detailUrl = detail.replace('{code}', code)
      return result
    }
  }
  return null
}
