# Python 装饰器与元类

- **难度**: 进阶
- **分类**: Python 语言特性 / 元编程
- **标签**: [装饰器, functools.wraps, __new__, __init__, metaclass]

## 核心概念

**装饰器**本质是**可调用对象**，接受一个函数/类并返回替换或包装后的对象。语法糖 `@decorator` 等价于 `f = decorator(f)`。**带参数装饰器**需要多一层嵌套：外层接收装饰器参数，内层接收被装饰对象。

**functools.wraps** 把被包装函数的 `__name__`、`__doc__`、`__module__` 等拷贝到 wrapper，避免调试与文档字符串丢失。

**`__new__`** 负责**创建实例**（调用父类 `object.__new__` 分配内存），**`__init__`** 负责**初始化已创建对象**。不可变类型（如某些内置类型子类）常需在 `__new__` 中处理。**元类**是「类的类」，默认 `type`，可控制类创建过程（如注册子类、校验属性、注入方法）。

## 详细解析

**函数装饰器**：常见模式为 `def wrapper(*args, **kwargs): ... return wrapper`，内部调用原函数并附加日志、鉴权、缓存等。

**类装饰器**：类本身可 `__call__`，或对类对象增删属性后返回原类/新类。

**元类**：`metaclass=M` 时，类体执行完毕后调用 `M.__new__(M, name, bases, namespace)` 产出类对象；可与描述符、`__set_name__` 配合做 ORM 字段声明等框架行为。

继承链中 `__new__` 与 `__init__` 的调用顺序：先子类 `__new__`，再（若返回实例）子类 `__init__`；若 `__new__` 返回非该类实例，**不会**自动调子类 `__init__`。

**描述符与装饰器组合**：`@property` 本质是描述符；类装饰器可在类创建后批量包装方法为 property 或注入校验逻辑。

**参数化类装饰器**：与函数装饰器同理，外层接收配置，内层接收类对象，返回修改后的类或代理类。

**元类与 `__init_subclass__`**：Python 3.6+ 可在基类中定义 `__init_subclass__` 拦截子类创建，许多框架场景可替代自定义元类，降低魔法感。

**叠加装饰器**：靠近 `def` 的先生效：`@a @b def f` 等价于 `f = a(b(f))`，顺序影响日志、鉴权、缓存等外层行为。

**`__call__` 与可调用实例**：类实现 `__call__` 后实例可作装饰器，适合带状态的装饰器对象（如限流器持有计数）。

**鸭子类型提醒**：装饰器只要「可调用且返回可调用」即可，不限于函数；`classmethod`/`staticmethod` 与装饰器组合时要注意绑定顺序，避免 `self` 错位。

## 示例代码

```python
from functools import wraps

def retry(times: int):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last = None
            for _ in range(times):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last = e
            raise last
        return wrapper
    return decorator

class Singleton(type):
    _instances = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Foo(metaclass=Singleton):
    pass
```

## 面试追问

- **追问 1**：`@classmethod` 装饰的 `__new__` 与实例化流程的关系？
- **追问 2**：`functools.lru_cache` 作为装饰器如何实现？与手写缓存装饰器的线程安全注意点？
- **追问 3**：元类与类装饰器都能改类定义，选型上何时用元类、何时用简单类装饰器？
- **追问 4**：`type(name, bases, dict)` 三参数形式与 `class` 语句等价性？元类中修改 `namespace` 与类装饰器修改类对象的时机差？

## 常见误区

- 不用 `wraps` 导致 **help()、栈追踪、单测 mock** 指向错误的函数名与文档。
- 认为 `__init__` 返回实例——`__init__` 必须返回 `None`，实例由 `__new__` 创建。
- 滥用元类增加阅读成本；多数需求用**类装饰器**或 `__init_subclass__`（Python 3.6+）即可。
- 装饰器写成「调用形式」`@decorator()` 与无参 `@decorator` 混淆——前者返回的是**真正的装饰器**，后者装饰器本身需直接接收被装饰对象。
- 在元类 `__new__` 中忘记调用 `super().__new__` 或错误构造 `namespace`，导致**元类冲突**（metaclass conflict）或多重继承时 MRO 与元类不兼容。
