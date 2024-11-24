"use client";
import { useState } from 'react';
import styles from "./chat.module.css";
import ReactMarkdown from 'react-markdown';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const getSystemPrompt = (role, prevMessages) => {
    const basePrompt = {
      'ux': `你是一个用户体验专家。请基于用户需求和其他设计师的意见，从用户体验角度提供具体的设计建议。
重点关注：
1. 用户交互和流程优化
2. 使用场景和用户需求分析
3. 功能布局和信息架构
4. 操作便利性和直观性

请具体说明：
- 用户痛点分析
- 交互设计方案
- 功能布局建议
- 与其他设计师方案的协调建议`,

      'industrial': `你是一个造型设计师。请基于用户需求、用户体验专家的建议，从产品造型角度提供具体的设计建议。
重点关注：
1. 产品形态和结构设计
2. 空间布局和尺寸规划
3. 功能性与美观性的平衡
4. 制造可行性

请具体说明：
- 造型设计方案
- 结构布局详细说明
- 关键尺寸和比例
- 与其他设计师方案的协调建议`,

      'cmf': `你是一个CMF设计师。请基于用户需求、用户体验专家和造型设计师的建议，从材料、颜色和工艺角度提供具体的设计建议。
重点关注：
1. 材料选择和搭配
2. 色彩规划和效果
3. 工艺可行性
4. 成本控制

请具体说明：
- 材料方案清单
- 色彩搭配方案
- 与其他设计师方案的协调建议`
    };

    // 获取之前所有的对话内容
    const previousDiscussion = prevMessages
      .filter(msg => !msg.isSent)
      .map(msg => ({
        role: "assistant",
        content: `[${msg.roleType === 'ux' ? '用户体验专家' : 
                     msg.roleType === 'industrial' ? '造型设计师' : 
                     'CMF设计师'}] ${msg.content}`
      }));

    return `${basePrompt[role]}

当前设计讨论的上下文：
${previousDiscussion.map(msg => msg.content).join('\n')}

请基于以上讨论和你的专业角度，提供详细的设计建议。你的建议应该：
1. 具体且可执行
2. 与其他设计师的建议相互呼应和补充
3. 指出潜在问题和解决方案
4. 提供明确的参数和标准

最终目标是形成一个完整、可行的设计方案。`;
  };

  const sendMessage = async () => {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    if (content && !isLoading) {
      setIsLoading(true);
      
      // 添加用户消息到界面
      const newMessages = [...messages, { content, isSent: true }];
      setMessages(newMessages);
      
      // 清空输入框
      messageInput.value = '';

      try {
        const apiKey = 'sk-vriszoxzcmjdbsoqikrbwqjqcltycylerdmhzjxxivurfzve';
        const roleTypes = ['ux', 'industrial', 'cmf'];

        // 一次性添加三个角色的空消息框
        const roleMessages = roleTypes.map(role => ({
          id: Date.now() + Math.random(),
          content: '',
          isSent: false,
          roleType: role
        }));
        
        setMessages(prev => [...prev, ...roleMessages]);

        // 依次获取每个角色的回复
        for (let i = 0; i < roleTypes.length; i++) {
          const role = roleTypes[i];
          const currentMessage = roleMessages[i];

          // 调用API获取响应
          const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "internlm/internlm2_5-7b-chat",
              messages: [
                {
                  role: "system",
                  content: getSystemPrompt(role, messages)
                },
                {
                  role: "user",
                  content: content
                }
              ],
              stream: true,
              temperature: 0.7,
              max_tokens: 2000
            })
          });

          // 处理流式响应
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let aiResponse = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content || '';
                  aiResponse += content;

                  // 更新对应角色的消息内容
                  setMessages(prev => prev.map(msg => 
                    msg.id === currentMessage.id
                      ? { ...msg, content: aiResponse }
                      : msg
                  ));
                } catch (e) {
                  console.error('解析响应数据失败:', e);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error details:', error);
        setMessages(prev => [...prev, { content: "抱歉，发生了一些错误。请稍后重试。", isSent: false }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <h2>CoDesign Lab</h2>
      </div>
      <div className={styles.chatMessages}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${styles.message} ${
              message.isSent ? styles.sent : styles.received
            }`}
            data-role={message.roleType}
          >
            {!message.isSent && (
              <div className={styles.messageRole}>
                {message.roleType === 'ux' ? '用户体验专家' : 
                 message.roleType === 'industrial' ? '造型设计师' : 
                 message.roleType === 'cmf' ? 'CMF设计师' : '用户'}
              </div>
            )}
            <div className={styles.messageContent}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.chatInput}>
        <input 
          type="text" 
          id="message-input" 
          placeholder="输入消息..." 
          disabled={isLoading}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isLoading) {
              sendMessage();
            }
          }}
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading}
          className={isLoading ? styles.loading : ''}
        >
          {isLoading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
}
