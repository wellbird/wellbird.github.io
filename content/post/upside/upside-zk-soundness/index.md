---
title: "[업사이드 아티클] ZK 증명은 과연 완벽한가? - 무너진 Soundness 사례들"
description: "수학이 아니라 구현에서 무너지는 영지식 증명의 건전성, 실제 사례로 살펴보기"
date: 2026-08-01
slug: "upside-zk-soundness"
image: "cover.png"
categories:
    - blockchain
    - cybersecurity
tags:
    - 업사이드 아티클
    - What
---

영지식 증명(ZKP)은 블록체인 곳곳에서 "무언가를 드러내지 않고 참임을 증명하는" 핵심 도구로 자리 잡았다. 보안성과 프라이버시를 동시에 보장하는 기술로 인식되지만, ZK를 쓰기만 하면 그만큼 안전해질까? 꼭 그렇지는 않다.

취약점이 발생하는 이유는 수학이 아니라 구현에 있다. 영지식 증명의 수학 자체는 견고하지만, 그 수학을 실제 회로로 옮기고 키를 만들어 배포하는 과정에서 작은 빈틈이 생기고, 그 빈틈 하나로 "거짓은 통과하면 안 된다"는 건전성(Soundness)이 무너진다. 이 아티클에서는 ZK 증명이 어떻게 만들어지고 검증되는지를 짚고, 실제 사건과 함께 건전성이 무너진 사례들을 살펴본다.

아래 링크에서 확인할 수 있다.

{{< linkcard
  url="https://upside.center/news/article/IiqsjPqa"
  title="ZK 증명은 과연 완벽한가? - 무너진 Soundness 사례들"
  description="업사이드 아카데미"
  image="cover.png"
>}}
