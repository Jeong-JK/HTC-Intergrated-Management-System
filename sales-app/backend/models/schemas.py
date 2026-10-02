"""HTC Inventory — Pydantic Models v3"""
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class ItemBase(BaseModel):
    rack_no:       Optional[str]     = ""
    box_no:        Optional[str]     = ""
    item_type:     str               = "라디오"
    category:      Optional[str]     = ""
    item_name:     str
    description:   Optional[str]     = ""
    serial:        Optional[str]     = ""
    ip:            Optional[str]     = ""
    mac:           Optional[str]     = ""
    status:        Optional[str]     = "데모"
    license_key:   Optional[str]     = ""
    purchase_date: Optional[str]     = None
    unit_price:    Optional[Decimal] = Decimal("0")
    exchange_rate: Optional[Decimal] = Decimal("1.0")
    total_price:   Optional[Decimal] = Decimal("0")
    note:          Optional[str]     = ""

    @validator("purchase_date", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v

class ItemCreate(ItemBase):
    pass

class ItemUpdate(ItemBase):
    item_name: Optional[str] = None


class InboundBase(BaseModel):
    item_id:       int
    quantity:      Optional[int]     = 1
    inbound_date:  str
    unit_price:    Optional[Decimal] = Decimal("0")
    exchange_rate: Optional[Decimal] = Decimal("1.0")
    note:          Optional[str]     = ""

class InboundCreate(InboundBase):
    pass

class InboundUpdate(BaseModel):
    quantity:      Optional[int]     = None
    inbound_date:  Optional[str]     = None
    unit_price:    Optional[Decimal] = None
    exchange_rate: Optional[Decimal] = None
    note:          Optional[str]     = None


# 여러개 추가 — 같은 품명에 serial/ip 여러 개
class ItemBulkEntry(BaseModel):
    serial: Optional[str] = ""
    ip:     Optional[str] = ""
    mac:    Optional[str] = ""
    note:   Optional[str] = ""

class ItemBulkCreate(BaseModel):
    rack_no:       Optional[str]     = ""
    box_no:        Optional[str]     = ""
    item_type:     str               = "라디오"
    category:      Optional[str]     = ""
    item_name:     str
    description:   Optional[str]     = ""
    status:        Optional[str]     = "데모"
    license_key:   Optional[str]     = ""
    purchase_date: Optional[str]     = None
    unit_price:    Optional[Decimal] = Decimal("0")
    exchange_rate: Optional[Decimal] = Decimal("1.0")
    note:          Optional[str]     = ""
    entries: List[ItemBulkEntry]     = []

    @validator("purchase_date", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v


# 입고처리 — 여러 품목 일괄 등록
class InboundBulkItem(BaseModel):
    rack_no:       Optional[str]     = ""
    box_no:        Optional[str]     = ""
    item_type:     str               = "라디오"
    category:      Optional[str]     = ""
    item_name:     str
    description:   Optional[str]     = ""
    serial:        Optional[str]     = ""
    ip:            Optional[str]     = ""
    mac:           Optional[str]     = ""
    status:        Optional[str]     = "새제품"
    license_key:   Optional[str]     = ""
    purchase_date: Optional[str]     = None
    unit_price:    Optional[Decimal] = Decimal("0")
    exchange_rate: Optional[Decimal] = Decimal("1.0")
    note:          Optional[str]     = ""
    supplier:      Optional[str]     = ""
    inbound_date:  Optional[str]     = None
    quantity:      Optional[int]     = 1

    @validator("purchase_date", "inbound_date", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v

class InboundBulkCreate(BaseModel):
    items: List[InboundBulkItem]


class RentalBase(BaseModel):
    item_id:         Optional[int] = None
    borrower:        str
    contact_name:    Optional[str] = ""
    contact_phone:   Optional[str] = ""
    purpose:         Optional[str] = ""
    quantity:        Optional[int] = 1
    rent_date:       str
    expected_return: Optional[str] = None
    returned_at:     Optional[str] = None
    note:            Optional[str] = ""

    @validator("expected_return", "returned_at", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v

class RentalCreate(RentalBase):
    pass

class RentalReturn(BaseModel):
    returned_at: str
    note:        Optional[str] = ""


class DeliveryBase(BaseModel):
    item_id:         Optional[int]     = None
    item_name:       Optional[str]     = ""
    client:          str
    project_name:    Optional[str]     = ""
    contact_name:    Optional[str]     = ""
    contact_phone:   Optional[str]     = ""
    quantity:        Optional[int]     = 1
    unit_price:      Optional[Decimal] = Decimal("0")
    delivery_date:   str
    status:          Optional[str]     = "납품예정"
    note:            Optional[str]     = ""

class DeliveryCreate(DeliveryBase):
    pass


# CRM - 업체 관리
class CompanyBase(BaseModel):
    company_name:   str
    contact_person: Optional[str] = ""
    contact_phone:  Optional[str] = ""

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    company_name:   Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone:  Optional[str] = None


# 헤더-아이템 분리 구조 대여 시스템
class RentalItemCreate(BaseModel):
    item_id:     Optional[int] = None
    item_name:   str
    description: Optional[str] = ""
    serial_ip:   Optional[str] = ""
    quantity:    int           = 1
    note:        Optional[str] = ""

class RentalHeaderCreate(BaseModel):
    company_id:      int
    rent_date:       str
    expected_return: Optional[str] = None
    purpose:         Optional[str] = ""
    items:           List[RentalItemCreate]

    @validator("expected_return", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v
