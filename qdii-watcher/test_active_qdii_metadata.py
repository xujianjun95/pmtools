import json
import unittest
from pathlib import Path

from refresh_active_qdii_metadata import derive_themes, fallback_regions, parse_holdings_rows, parse_holdings_text, parse_industries, parse_regions, parse_report_top_holdings, sanitize_top_holdings


class ActiveQdiiPoolTest(unittest.TestCase):
    def test_pool_contains_104_unique_products(self):
        path = Path(__file__).resolve().parent / "active_qdii_pool.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        codes = [fund["code"] for fund in payload["funds"]]

        self.assertEqual(payload["count"], 104)
        self.assertEqual(len(codes), 104)
        self.assertEqual(len(set(codes)), 104)
        self.assertTrue(all(fund["share_codes"] for fund in payload["funds"]))


class ReportMetadataParserTest(unittest.TestCase):
    REPORT_TEXT = """
    7.2 期末在各个国家（地区）证券市场的权益投资分布
    国家（地区）
    美国
    1,000,000.00
    45.18
    中国香港
    500,000.00
    21.88
    日本
    100,000.00
    4.20
    合计
    1,600,000.00
    71.26
    7.3 期末按行业分类的权益投资组合
    信息技术
    900,000.00
    40.00
    医疗保健
    300,000.00
    15.00
    7.4 期末按公允价值占基金资产净值比例大小排序的所有权益投资明细
    """

    def test_parses_material_regions_and_industries(self):
        regions = parse_regions(self.REPORT_TEXT)
        industries = parse_industries(self.REPORT_TEXT)

        self.assertEqual([item["label"] for item in regions], ["美国", "中国香港"])
        self.assertEqual([item["label"] for item in industries], ["信息技术", "医疗保健"])

    def test_name_theme_has_priority_and_is_deduplicated(self):
        themes = derive_themes(
            "景顺长城全球半导体芯片股票",
            [{"label": "信息技术", "weight": 60}],
        )

        self.assertEqual(themes, ["半导体", "科技"])

    def test_portfolio_without_report_uses_name_region(self):
        self.assertEqual(fallback_regions("广发港股优选混合")[0]["label"], "中国香港")

    def test_parses_top_three_holdings_from_report_table(self):
        rows = [
            ["序号", "公司名称\n(英文)", "公司名称\n(中文)", "证券代码", "占基金资产净值比例（％）"],
            ["1", "Micron\nTechnology Inc", "美光科技\n股份有限公司", "MU US", "6.16"],
            ["2", "Lam Research Corp", "泛林集团", "LRCX US", "4.50"],
            ["3", "ASML Holding NV", "阿斯麦控股公司", "ASML US", "4.35"],
            ["4", "Apple Inc", "苹果公司", "AAPL US", "2.57"],
        ]

        self.assertEqual(parse_holdings_rows(rows), [
            {"name": "美光科技股份有限公司", "weight": 6.16},
            {"name": "泛林集团", "weight": 4.5},
            {"name": "阿斯麦控股公司", "weight": 4.35},
        ])

    def test_parses_top_three_holdings_from_split_pdf_text(self):
        text = """
        7.4 期末按公允价值占基金资产净值比例大小排序的所有权益投资明细
        1
        NVIDIA
        Corp
        英伟达
        公司 NVDA US 美国
        617,007 840,852,808.83
        8.14
        2
        Marvell Technology Inc
        美满电子
        科技公司 MRVL US 美国
        406,058 823,850,670.55
        7.98
        3 Apple Inc 苹果公司 AAPL US 美国
        352,357 694,425,888.77
        6.73
        4 Microsoft Corp 微软公司 MSFT US 美国
        """

        self.assertEqual(parse_holdings_text(text), [
            {"name": "英伟达公司", "weight": 8.14},
            {"name": "美满电子科技公司", "weight": 7.98},
            {"name": "苹果公司", "weight": 6.73},
        ])

    def test_parses_holdings_across_pdf_pages(self):
        text = """
        7.4 期末按公允价值占基金资产净值比例大小排序的所有权益投资明细
        1 Apple Inc 苹果公司 AAPL UW
        214,321 422,384,260.59 8.29
        2 NVIDIA 英伟达 NVDA UW
        292,144 398,131,792.64
        7.81
        基金中期报告 第 41 页
        3 Microsoft Corp 微软公司 MSFT UW
        100,000 300,000,000.00
        5.88
        4 Amazon Inc 亚马逊公司 AMZN UW
        7.5 报告期内权益投资组合的重大变动
        """

        self.assertEqual(parse_report_top_holdings(text), [
            {"name": "苹果公司", "weight": 8.29},
            {"name": "英伟达", "weight": 7.81},
            {"name": "微软公司", "weight": 5.88},
        ])

    def test_sanitizes_non_company_rows_and_orders_by_weight(self):
        holdings = [
            {"name": "债券投资收益6.4.7.1", "weight": 7.1},
            {"name": "苹果公司", "weight": 8.29},
            {"name": "—", "weight": 7.8},
            {"name": "微软公司", "weight": 5.88},
        ]

        self.assertEqual(sanitize_top_holdings(holdings), [
            {"name": "苹果公司", "weight": 8.29},
            {"name": "微软公司", "weight": 5.88},
        ])


if __name__ == "__main__":
    unittest.main()
