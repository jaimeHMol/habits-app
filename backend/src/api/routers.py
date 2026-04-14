from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from src.domain.models import Task, TaskCreate, TaskUpdate, ColumnId
from src.application.services import TaskService
from src.api.dependencies import get_task_service
from src.api.security import get_current_user

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
    dependencies=[Depends(get_current_user)],  # The lock
)


# --- Schemas for specific requests ---
class ReorderRequest(BaseModel):
    column_id: ColumnId
    task_ids: List[int]


# --- Endpoints ---


@router.get("/", response_model=List[Task])
def get_all_tasks(service: TaskService = Depends(get_task_service)):
    return service.get_all_tasks()


@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, service: TaskService = Depends(get_task_service)):
    return service.create_new_task(task_in)


@router.put("/{task_id}", response_model=Task)
def update_task(
    task_id: int, task_in: TaskUpdate, service: TaskService = Depends(get_task_service)
):
    task = service.update_task_details(task_id, task_in)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, service: TaskService = Depends(get_task_service)):
    success = service.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return None


@router.patch("/{task_id}/complete", response_model=Task)
def toggle_task_completion(
    task_id: int, service: TaskService = Depends(get_task_service)
):
    task = service.toggle_completion(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/reorder/column", status_code=status.HTTP_200_OK)
def reorder_tasks(
    request: ReorderRequest, service: TaskService = Depends(get_task_service)
):
    success = service.reorder_column(request.column_id, request.task_ids)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to reorder tasks")
    return {"message": "Reorder successful"}
