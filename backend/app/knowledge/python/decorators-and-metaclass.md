# Python 装饰器与元类

- **难度**: 进阶
- **分类**: Python 语言特性 / 元编程
- **标签**: [装饰器, functools.wraps, __new__, __init__, metaclass]

## 核心概念

**装饰器就像给礼物包装**。你有一个函数（礼物），装饰器在外面裹一层漂亮的包装纸（附加功能），但礼物本身没变。`@decorator` 就是 `f = decorator(f)` 的语法糖——把原函数传进去，拿到一个"包装后"的新函数。

**元类就是"造模具的模具"**。普通的类（模具）用来造对象（产品），而元类用来造类本身。默认的元类是 `type`——当你写 `class Foo: ...` 的时候，Python 其实在调用 `type('Foo', (base,), {...})` 来创建 Foo 这个类。

## 详细解析

### 装饰器——从简单到带参数

**最简单的装饰器**：接收一个函数，返回一个新函数，中间加点料。

```python
def log(func):
    def wrapper(*args, **kwargs):
        print(f"调用 {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log
def say_hello():
    print("Hello!")
# 等价于: say_hello = log(say_hello)
```

**带参数的装饰器**：需要多嵌套一层——外层接收参数，内层才是真正的装饰器。就像先选好包装纸的颜色，再去包礼物。

**`functools.wraps` 为什么重要？** 不加它，被包装后的函数名会变成 `wrapper`，`help()` 和调试信息都乱了。`@wraps(func)` 把原函数的名字、文档等信息拷贝到 wrapper 上。

### `__new__` vs `__init__`

- `__new__`：**造房子**——负责创建实例（分配内存），返回一个对象
- `__init__`：**搬家具**——负责初始化已经造好的实例，不返回任何东西

99% 的情况你只需要写 `__init__`。只有在继承不可变类型（如 `str`、`tuple`）或需要控制实例创建逻辑（如单例模式）时才需要 `__new__`。

### 元类——什么时候需要？

大部分场景**不需要元类**。Python 3.6+ 提供了 `__init_subclass__`，简单的子类注册、属性校验用它就够了。真正需要元类的场景：ORM 框架的字段声明、注册表模式、强制接口约束等。

**叠加装饰器的顺序**：`@a @b def f` 等价于 `f = a(b(f))`——离 `def` 近的先执行。

## 示例代码

```python
from functools import wraps

# 带参数的装饰器：重试 N 次
def retry(times: int):
    def decorator(func):           # 这才是真正的装饰器
        @wraps(func)               # 保留原函数的名字和文档
        def wrapper(*args, **kwargs):
            last_error = None
            for _ in range(times):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
            raise last_error
        return wrapper
    return decorator

@retry(times=3)                    # 先调用 retry(3) 得到装饰器，再装饰函数
def fetch_data():
    pass  # 可能会失败的网络请求

# 用元类实现单例模式
class Singleton(type):
    _instances = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Config(metaclass=Singleton):
    pass
# Config() is Config()  → True，全局只有一个实例
```

## 面试追问

- **面试官可能会这样问你**：`functools.lru_cache` 的原理？它线程安全吗？（内部用字典缓存结果，CPython 下有 GIL 保护的基本线程安全，但多进程环境下缓存不共享）
- **面试官可能会这样问你**：元类和类装饰器都能修改类，怎么选？（能用类装饰器或 `__init_subclass__` 解决就不用元类——元类更强大但也更难理解和维护）
- **面试官可能会这样问你**：`@decorator` 和 `@decorator()` 有什么区别？（前者直接把函数传给 decorator；后者先调用 `decorator()` 返回真正的装饰器，再把函数传进去——少写括号或多写括号都会报错）
- **面试官可能会这样问你**：`__init__` 能返回值吗？（不能！必须返回 None，实例是由 `__new__` 创建的）

## 常见误区

- **很多人会搞混的地方**：不用 `@wraps`——调试时函数名变成 wrapper，`help()` 和单测 mock 都出问题。
- **很多人会搞混的地方**：以为 `__init__` 创建实例——`__init__` 只是初始化，实例是 `__new__` 创建的。
- **很多人会搞混的地方**：滥用元类——90% 的需求用类装饰器或 `__init_subclass__` 就能搞定，元类只会增加阅读成本。
- **很多人会搞混的地方**：`@decorator` 和 `@decorator()` 搞混——前者的 decorator 直接接收函数，后者需要 decorator() 先返回一个真正的装饰器。
