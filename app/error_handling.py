"""
Central error handling for the backend.

Goals (this was an explicit gap in the earlier build - see README "Error
handling" section):
  1. Every error response, whatever caused it, has the SAME JSON shape:
         {"error": {"code": "...", "message": "...", "detail": ... }}
     so Member A's app and the dashboard only need one error-parsing path.
  2. Unhandled exceptions never leak a Python traceback to the client - they
     get logged server-side with full detail and return a generic 500.
  3. Pydantic validation errors (malformed request bodies) come back as a
     clean 422 with field-level detail instead of FastAPI's default shape,
     still useful for debugging but consistent with the rest of the API.
  4. Domain-known failure modes (bad image upload, unreadable file) are
     caught close to the source and turned into clean 4xx responses instead
     of bubbling up as unhandled 500s.
"""
import logging
import traceback
import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("tobaccoshield")


def _error_body(code: str, message: str, detail=None, request_id: str | None = None) -> dict:
    body = {"error": {"code": code, "message": message}}
    if detail is not None:
        body["error"]["detail"] = detail
    if request_id:
        body["error"]["request_id"] = request_id
    return body


def install_error_handlers(app: FastAPI) -> None:

    @app.middleware("http")
    async def add_request_id_and_log(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        try:
            response = await call_next(request)
        except Exception:
            # Safety net: if something slips past the exception handlers below
            # (e.g. an error raised while streaming a response), still log it
            # with a request id instead of crashing the worker silently.
            logger.error("Unhandled exception [%s] on %s %s\n%s",
                         request_id, request.method, request.url.path, traceback.format_exc())
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=_error_body("internal_error", "Something went wrong. Please try again.",
                                     request_id=request_id),
            )
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        # Keep the FastAPI/Starlette HTTPException path but normalize the body shape.
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(code=_code_for_status(exc.status_code), message=str(exc.detail)),
            headers=getattr(exc, "headers", None) or {},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.info("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body(
                code="validation_error",
                message="Request body failed validation.",
                detail=exc.errors(),
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = str(uuid.uuid4())[:8]
        logger.error("Unhandled exception [%s] on %s %s\n%s",
                     request_id, request.method, request.url.path, traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("internal_error", "Something went wrong. Please try again.",
                                 request_id=request_id),
        )


def _code_for_status(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
    }.get(status_code, "error")
