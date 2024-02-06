---
layout: post
title: "[자바스크립트] 자바스크립트에서의 세미콜론(feat. ASI)"
description: >
  자바스크립트에서의 세미콜론(feat. ASI)
categories : fe
tags : js
image: /assets/img/thumbnail/javascript.jpg
comments : true
# related_posts:
---
* toc
{:toc}

요즘은 면접을 위한 공부와 개인 포트폴리오 제작을 하며 보내고있다. 또한 틈틈이 블로그에 포스팅 할 글들을 정리하는 중이다. 이렇게 정리만 하다간 블로그 포스팅이 늦어질 것 같아 블로그의 첫 글은 가벼운 주제에 대해서 포스팅해볼까 한다.

## 자바스크립트에서의 세미콜론
다른 언어에서와 마찬가지로 자바스크립트에서의 세미콜론(;)은 문(statement)의 종료를 나타낸다. 세미콜론을 사용함으로써 문장이 어디에서 끝나는지를 명확하게 표현해주는 것이다. 이는 코드의 가독성을 높이고 잠재적인 오류를 방지하는데 도움이 된다.

자바스크립트는 세미콜론을 생략할 수 있는 언어로 대부분의 상황에서는 세미콜론 없이도 코드가 정상적으로 작동한다. 이는 자바스크립트 엔진이 '자동 세미콜론 삽입(Automatic Semicolon Insertion, ASI)'이라는 메커니즘을 통해 세미콜론을 자동으로 삽입하기 때문이다.

## ASI 메커니즘의 문제점
하지만 자바스크립트 개발자는 ASI를 전적으로 신뢰해서는 안된다. 자바스크립트 엔진의 ASI는 개발자의 의도와 다르게 동작하는 경우가 종종 있기 때문이다.

### 구문을 일찍 종결시키는 경우
ASI는 세미콜론을 자동으로 삽입하고 개발자가 작성한 구문을 일찍 종결시켜 개발자의 의도와 다르게 동작하게 만들 수 있다. return, throw, break, continue 등의 문장들이 이러한 경우들이다.
```javascript
function getValue() {
    return
    'hello world'
}
console.log(getValue()) // undefined
```
이 코드에서 콘솔에 찍히는 결과는 undefined이다. 자바스크립트 엔진이 return 문장 이후에 세미콜론을 자동으로 삽입하여 문장을 종결시키기 때문이다.

### 구문을 연결시키는 경우
반대로 ASI는 개발자의 예상과 다르게 세미콜론을 자동으로 삽입하지 않아 구문을 연결시킬 수도 있다. 줄 바꿈 후에 괄호([], {}, ())나 플러스(+), 마이너스(-) 연산자로 시작하는 문장들이 이러한 경우이다. 자바스크립트 엔진은 이런 경우에 해당 문장이 이전 줄의 계속이라고 판단한다.
```javascript
let first = "a"
let second = "b"
[first, second] = [second, first] // ReferenceError: Cannot access 'second' before initialization
```
위의 코드는 자바스크립트의 구조 분해 할당을 통하여 두 변수의 값을 바꿔주는 코드이다. 하지만 이 코드를 실행해보면 레퍼런스 에러가 나는 것을 확인할 수 있다.

이 코드에서 세 번째 줄의 대괄호([])는 자바스크립트 엔진에게 이전 줄이 끝나지 않았음을 암시한다. 따라서 자바스크립트 엔진은 두 번째 줄과 세 번째 줄을 연결하려고 시도하며 이 과정에서 let second = "b" [first, second] = [second, first]라는 코드를 해석하려고 시도하게 된다. 이 때문에 "Cannot access 'second' before initialization"라는 오류가 발생한다.

```javascript
let first = "a";
let second = "b";
[first, second] = [second, first];
```
개발자가 직접 세미콜론을 추가하면 각 줄이 별도의 문장임을 명확하게 알려주기 때문에 위와 같은 오류를 방지할 수 있다.

이 외에도 템플릿 리터럴(Template Literals) 백틱(`)으로 시작하는 경우, 증감 연산자(++, --)로 시작하는 경우, yield 구문을 사용하는 경우등 ASI가 개발자의 의도와는 다르게 구문을 연결시키는 경우는 매우 다양하다.

## 마무리
자바스크립트의 ASI 덕분에 종종 개발자들은 세미콜론을 넣지 않는 습관을 갖게 된다. 하지만 이는 개발자의 의도와 다르게 코드가 동작하게 되는 원인중 하나가 되기도 한다. *<span style="color:gray;">(대부분의 자바스크립트 코딩 컨벤션들이 세미콜론을 붙이는 이유도 이러한 이유인 것 같다.)</span>* 따라서 자바스크립트 개발자들은 번거롭더라도 직접 세미콜론을 붙이는 습관을 들이거나 코딩 포멧터 등을 사용해 세미콜론을 붙여 본인의 의도대로 코드를 동작할 수 있게 해야한다.

<br/>
<br/>
<center>
  <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fwellbird.github.io%2Ffe%2F2024-02-06-semicolonInJS%2F&count_bg=%23BBBBBB&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=View&edge_flat=false" />
</center>