#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
재고 수량 조정 확인 (Dry Run만)
"""

from adjust_quantities import analyze_quantities

if __name__ == '__main__':
    analyze_quantities(dry_run=True)
