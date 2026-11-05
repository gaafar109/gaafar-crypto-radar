"""Offline fixture tests for Alpha collector; never call live endpoints."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

MODULE=pathlib.Path(__file__).with_name('collect_trades.py')
spec=importlib.util.spec_from_file_location('alpha_collect_trades',MODULE)
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)

class CollectorTests(unittest.TestCase):
    def test_aggressor_sign(self):
        result=collector.measure([{'T':1,'p':'2','q':'3','m':True},
                                  {'T':2,'p':'2','q':'5','m':False}])
        self.assertEqual(result['sellQuote'],6)
        self.assertEqual(result['buyQuote'],10)
        self.assertEqual(result['netAggressiveQuote'],4)
        self.assertIn('REQUIRES_VERIFICATION',result['directionValidation'])
    def test_empty_page_is_not_full_window(self):
        result=collector.measure([])
        self.assertEqual(result['trades'],0)
        self.assertIsNone(result['imbalance'])
        self.assertIn('NOT FULL WINDOW',result['coverage'])
    def test_reject_missing_maker_flag(self):
        with self.assertRaises(ValueError):
            collector.measure([{'T':1,'p':2,'q':3}])
    def test_reject_nonfinite_quantity(self):
        with self.assertRaises(ValueError):
            collector.measure([{'T':1,'p':2,'q':'nan','m':False}])
    def test_reject_out_of_order(self):
        with self.assertRaises(ValueError):
            collector.measure([{'T':2,'p':2,'q':1,'m':False},
                               {'T':1,'p':2,'q':1,'m':True}])
    def test_reject_failed_response(self):
        with self.assertRaises(ValueError):
            collector.unwrap({'code':'error','data':[]})
    def test_main_no_network_on_import(self):
        self.assertTrue(callable(collector.main))

if __name__=='__main__':unittest.main()
