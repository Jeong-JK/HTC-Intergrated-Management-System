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
    quantity:      Optional[int]     = 1
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


# 위치 일괄 변경
class LocationBulkUpdate(BaseModel):
    ids:     List[int]
    rack_no: Optional[str] = None
    box_no:  Optional[str] = None

# 라이센스 일괄 변경
class LicenseBulkUpdate(BaseModel):
    ids:         List[int]
    license_key: str


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
    item_name:       Optional[str] = ""
    description:     Optional[str] = ""
    borrower:        str
    contact_name:    Optional[str] = ""
    contact_position: Optional[str] = ""
    contact_phone:   Optional[str] = ""
    purpose:         Optional[str] = ""
    quantity:        Optional[int] = 1
    rent_date:       str
    expected_return: Optional[str] = None
    returned_at:     Optional[str] = None
    needs_check:     Optional[bool] = False
    note:            Optional[str] = ""

    @validator("expected_return", "returned_at", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v

class RentalCreate(RentalBase):
    pass

class RentalReturn(BaseModel):
    returned_at:      str
    return_quantity:  Optional[int] = None  # None = 전체 반납, 숫자 = 부분 반납
    note:             Optional[str] = ""
    # 반납 후 재고 상태 (item_id가 없는 경우 사용)
    return_status:    Optional[str] = "데모"  # 새제품/데모

class RentalExtend(BaseModel):
    new_expected_return: str
    note:                Optional[str] = ""

    @validator("new_expected_return", pre=True)
    def empty_str_to_none(cls, v):
        if not v or v == "":
            raise ValueError("새로운 반납예정일은 필수입니다")
        return v

class RentalGroupUpdate(BaseModel):
    rent_date:       str
    borrower:        str
    original_contact_name: Optional[str] = None
    contact_name:    Optional[str] = ""
    contact_position: Optional[str] = ""
    contact_phone:   Optional[str] = ""
    expected_return: Optional[str] = None
    note:            Optional[str] = ""

    @validator("expected_return", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v


class RentalItemUpdate(BaseModel):
    """개별 대여 품목 수정"""
    item_id:      Optional[int] = None  # 새 장비로 교체 시 사용
    item_name:    Optional[str] = None
    description:  Optional[str] = None
    quantity:     Optional[int] = None
    note:         Optional[str] = None


class DeliveryGroupUpdate(BaseModel):
    delivery_date:         Optional[str]  # NULL 허용 (미정인 경우)
    client:                str
    original_contact_name: Optional[str] = None
    new_delivery_date:     Optional[str] = None
    new_client:            Optional[str] = None
    project_name:          str = ""
    contact_name:          str = ""
    contact_position:      str = ""
    contact_phone:         str = ""
    note:                  str = ""


class DeliveryBase(BaseModel):
    item_id:         Optional[int]     = None
    item_name:       Optional[str]     = ""
    description:     Optional[str]     = ""
    serial_ip:       Optional[str]     = ""
    client:          str
    project_name:    Optional[str]     = ""
    contact_name:    Optional[str]     = ""
    contact_position: Optional[str]    = ""
    contact_phone:   Optional[str]     = ""
    quantity:        Optional[int]     = 1
    unit_price:      Optional[Decimal] = Decimal("0")
    delivery_date:   Optional[str]     = None  # 미정 허용
    status:          Optional[str]     = "납품예정"
    note:            Optional[str]     = ""

    @validator("delivery_date", pre=True)
    def empty_str_to_none(cls, v):
        return None if v == "" else v

class DeliveryCreate(DeliveryBase):
    pass

class DeliveryConfirm(BaseModel):
    delivery_date: str  # 실제 납품일


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
