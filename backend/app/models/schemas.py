from pydantic import BaseModel, Field


class ApiResponse(BaseModel):
    code: int = Field(default=200, description="状态码")
    message: str = Field(default="success", description="状态信息")
    data: dict | list | None = None


class KnowledgePointOut(BaseModel):
    id: str
    title: str
    category: str
    subcategory: str | None = None
    difficulty: str
    tags: list[str]
    content: str


class KnowledgeCategoryOut(BaseModel):
    id: str = Field(description="分类 ID")
    name: str = Field(description="分类名称")
    description: str = Field(description="分类描述")
    count: int = Field(description="知识点数量")


class InterviewStartRequest(BaseModel):
    position: str = Field(description="岗位方向：后端开发/前端开发/算法工程师/数据开发")
    difficulty: str = Field(default="中等", description="难度：简单/中等/困难")
    company: str | None = Field(default=None, description="目标公司")


class InterviewAnswerRequest(BaseModel):
    session_id: str = Field(description="面试会话 ID")
    question_index: int = Field(description="题目序号")
    answer: str = Field(description="用户回答")


class InterviewSessionOut(BaseModel):
    session_id: str
    position: str
    difficulty: str
    current_stage: str
    current_question: str
    question_index: int
    total_questions: int


class ResumeAnalyzeRequest(BaseModel):
    resume_text: str = Field(description="简历文本内容", min_length=50)


class ResumeAnalysisOut(BaseModel):
    highlights: list[str] = Field(description="简历亮点")
    questions: list[dict] = Field(description="预测面试问题")
    improvements: list[str] = Field(description="改进建议")
